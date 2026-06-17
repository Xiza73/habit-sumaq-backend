import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { DebtLoanRepository } from '../../domain/debt-loan.repository';
import { DebtLoanPayment } from '../../domain/debt-loan-payment.entity';
import { DebtLoanPaymentRepository } from '../../domain/debt-loan-payment.repository';
import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';
import { BulkSettleResultDto } from '../dto/bulk-settle-result.dto';

import type { BulkSettleByReferenceDto } from '../dto/bulk-settle-by-reference.dto';

/**
 * POST /debts/settle-by-reference. Liquida todas las rows PENDING de una
 * misma `reference` (case+accent insensitive) en una sola operación.
 *
 *  - **Real-payment** (`dto.currency` presente): solo se tocan las rows
 *    de esa currency. El delta neto al pool de esa moneda =
 *    Σ LOANs.remainingAmount - Σ DEBTs.remainingAmount.
 *
 *  - **Informal-close** (`dto.currency` omitido): se tocan todas las
 *    rows pendientes de la reference (en cualquier moneda) sin tocar
 *    ningún pool.
 *
 * Si no hay rows pendientes que matcheen, devuelve un result con
 * `settledCount = 0` — NO es error.
 *
 * Toda la operación va dentro de una sola tx para garantizar atomicidad
 * incluso cuando hay N rows + 1 delta de pool + N rows de payment history
 * (una por cada settle individual aplicado — mismo patrón que
 * `SettleDebtLoanUseCase`).
 */
@Injectable()
export class BulkSettleByReferenceUseCase {
  constructor(
    private readonly repo: DebtLoanRepository,
    private readonly paymentRepo: DebtLoanPaymentRepository,
    private readonly poolService: CurrencyPoolService,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(BulkSettleByReferenceUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(userId: string, dto: BulkSettleByReferenceDto): Promise<BulkSettleResultDto> {
    const reference = dto.reference?.trim();
    if (!reference) {
      throw new DomainException('DEBT_LOAN_REFERENCE_REQUIRED', '`reference` no puede estar vacía');
    }

    const targets = await this.repo.findPendingByNormalizedReference(
      userId,
      reference,
      dto.currency,
    );

    if (targets.length === 0) {
      return Object.assign(new BulkSettleResultDto(), {
        settledCount: 0,
        totalSettledAmount: 0,
        currency: dto.currency ?? null,
        settledIds: [],
      });
    }

    // Defensive cross-user guard — the repo query already filters by
    // userId, but if anything ever bypasses that path, this is the
    // last line of defense.
    for (const row of targets) {
      if (row.userId !== userId) {
        throw new DomainException(
          'DEBT_LOAN_BELONGS_TO_OTHER_USER',
          'No tenés acceso a una de las deudas/préstamos',
        );
      }
    }

    const isRealPayment = dto.currency !== undefined;

    const result = await this.dataSource.transaction(async (manager) => {
      let netDelta = 0;
      let totalSettled = 0;
      const settledIds: string[] = [];

      for (const row of targets) {
        const settleAmount = row.remainingAmount;
        row.applySettlement(settleAmount);
        await this.repo.save(row, manager);
        totalSettled += settleAmount;
        settledIds.push(row.id);

        // Historial Fase 1: una row de payment por cada settle aplicado,
        // dentro de la MISMA tx que el UPDATE de remainingAmount. Mismo
        // shape que `SettleDebtLoanUseCase`. `note` siempre null hasta
        // Fase 2 (edit/delete).
        await this.paymentRepo.create(
          new DebtLoanPayment(
            randomUUID(),
            row.id,
            settleAmount,
            dto.currency ?? null,
            null,
            new Date(),
          ),
          manager,
        );

        if (isRealPayment) {
          // DEBT settle = pay = debit; LOAN settle = collect = credit.
          netDelta += row.type === DebtLoanType.DEBT ? -settleAmount : settleAmount;
        }
      }

      if (isRealPayment && netDelta !== 0) {
        // dto.currency is non-undefined here (isRealPayment guards it),
        // and all targets share that currency since findPending was
        // filtered by it.
        await this.poolService.applyDelta(userId, dto.currency!, netDelta, manager);
      }

      return { totalSettled, settledIds, netDelta };
    });

    this.logger.info(
      {
        event: 'debt_loan.bulk_settled',
        mode: isRealPayment ? 'real-payment' : 'informal',
        userId,
        reference,
        currency: dto.currency ?? null,
        settledCount: result.settledIds.length,
        totalSettledAmount: result.totalSettled,
        netPoolDelta: result.netDelta,
      },
      'debt_loan.bulk_settled',
    );

    return Object.assign(new BulkSettleResultDto(), {
      settledCount: result.settledIds.length,
      totalSettledAmount: result.totalSettled,
      currency: dto.currency ?? null,
      settledIds: result.settledIds,
    });
  }
}
