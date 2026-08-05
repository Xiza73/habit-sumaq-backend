import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { toCents } from '@common/money/to-cents';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { DebtLoanRepository } from '../../domain/debt-loan.repository';
import { DebtLoanPayment } from '../../domain/debt-loan-payment.entity';
import { DebtLoanPaymentRepository } from '../../domain/debt-loan-payment.repository';
import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';
import { SettleAmountByReferenceResultDto } from '../dto/settle-amount-by-reference-result.dto';

import type { SettleAmountByReferenceDto } from '../dto/settle-amount-by-reference.dto';

/**
 * POST /debts/settle-amount-by-reference — the "Mochila" settle.
 *
 * Reparte un MONTO elegido, oldest-first (FIFO), sobre las rows PENDING de
 * UNA persona (`reference`), UNA moneda (`currency`) y UNA dirección
 * (`type`). Por cada deuda de más vieja a más nueva se liquida
 * `min(remainingAmount, amountLeft)` hasta agotar el monto; la última
 * tocada puede quedar parcialmente liquidada. Si el monto supera la suma de
 * saldos pendientes, se liquidan TODAS (cap — no es error, el excedente se
 * ignora).
 *
 * **Real-vs-informal**: `currency` es obligatoria (identifica el grupo), así
 * que el toggle de modo NO puede venir por su presencia como en los otros
 * settles. Se usa el flag explícito `dto.realPayment`:
 *  - `true`  → real-payment: aplica el delta neto al pool de esa moneda
 *    (DEBT settle = −pool; LOAN settle = +pool). Como todas las rows
 *    comparten `type`, el neto tiene un único signo.
 *  - omitido / `false` → cierre informal: no toca el pool.
 *
 * Toda la operación (N updates de rows + N rows de payment history + 0/1
 * delta de pool) corre en una sola `dataSource.transaction()` para
 * garantizar atomicidad — mismo patrón que `BulkSettleByReferenceUseCase`.
 *
 * Toda la aritmética de dinero se hace en centavos enteros (`toCents`) para
 * evitar drift de floats al sumar/comparar saldos parciales.
 */
@Injectable()
export class SettleAmountByReferenceUseCase {
  constructor(
    private readonly repo: DebtLoanRepository,
    private readonly paymentRepo: DebtLoanPaymentRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(SettleAmountByReferenceUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    userId: string,
    dto: SettleAmountByReferenceDto,
  ): Promise<SettleAmountByReferenceResultDto> {
    const reference = dto.reference?.trim();
    if (!reference) {
      throw new DomainException('DEBT_LOAN_REFERENCE_REQUIRED', '`reference` no puede estar vacía');
    }

    const targets = await this.repo.findPendingByReferenceCurrencyType(
      userId,
      reference,
      dto.currency,
      dto.type,
    );

    if (targets.length === 0) {
      throw new DomainException(
        'DEBT_LOAN_NO_PENDING_FOR_REFERENCE',
        'No hay obligaciones pendientes para esa referencia, moneda y tipo',
      );
    }

    // Defensive cross-user guard — the repo query already filters by userId,
    // but this is the last line of defense if anything ever bypasses it.
    for (const row of targets) {
      if (row.userId !== userId) {
        throw new DomainException(
          'DEBT_LOAN_BELONGS_TO_OTHER_USER',
          'No tenés acceso a una de las deudas/préstamos',
        );
      }
    }

    const isRealPayment = dto.realPayment === true;
    const paymentCurrency = isRealPayment ? dto.currency : null;

    const outcome = await this.dataSource.transaction(async (manager) => {
      let amountLeftCents = toCents(dto.amount);
      let settledCount = 0;
      let fullySettledCount = 0;
      let totalSettledCents = 0;
      let netDeltaCents = 0;
      let partiallySettledId: string | null = null;

      for (const row of targets) {
        if (amountLeftCents <= 0) break;

        const remainingCents = toCents(row.remainingAmount);
        const settleCents = Math.min(remainingCents, amountLeftCents);
        if (settleCents <= 0) continue;

        const settleAmount = settleCents / 100;
        row.applySettlement(settleAmount);
        await this.repo.save(row, manager);

        // Historial: una row de payment por cada settle aplicado, dentro de
        // la MISMA tx. `note` siempre null (se edita en el flujo de Fase 2).
        await this.paymentRepo.create(
          new DebtLoanPayment(
            randomUUID(),
            row.id,
            settleAmount,
            paymentCurrency,
            null,
            new Date(),
          ),
          manager,
        );

        settledCount += 1;
        totalSettledCents += settleCents;
        amountLeftCents -= settleCents;

        if (settleCents >= remainingCents) {
          fullySettledCount += 1;
        } else {
          // FIFO guarantees at most one partial — it's always the last row
          // we touch (after a partial, amountLeft is 0 and we stop).
          partiallySettledId = row.id;
        }

        if (isRealPayment) {
          netDeltaCents += row.type === DebtLoanType.DEBT ? -settleCents : settleCents;
        }
      }

      if (isRealPayment && netDeltaCents !== 0) {
        await this.poolService.applyDelta(userId, dto.currency, netDeltaCents / 100, manager);
      }

      return {
        settledCount,
        fullySettledCount,
        totalSettledAmount: totalSettledCents / 100,
        netPoolDelta: netDeltaCents / 100,
        partiallySettledId,
      };
    });

    this.logger.info(
      {
        event: 'debt_loan.settled_amount_by_reference',
        mode: isRealPayment ? 'real-payment' : 'informal',
        userId,
        reference,
        currency: dto.currency,
        type: dto.type,
        requestedAmount: dto.amount,
        settledCount: outcome.settledCount,
        fullySettledCount: outcome.fullySettledCount,
        totalSettledAmount: outcome.totalSettledAmount,
        netPoolDelta: outcome.netPoolDelta,
        partiallySettledId: outcome.partiallySettledId,
      },
      'debt_loan.settled_amount_by_reference',
    );

    return Object.assign(new SettleAmountByReferenceResultDto(), {
      settledCount: outcome.settledCount,
      totalSettledAmount: outcome.totalSettledAmount,
      fullySettledCount: outcome.fullySettledCount,
      partiallySettledId: outcome.partiallySettledId,
      currency: dto.currency,
      type: dto.type,
    });
  }
}
