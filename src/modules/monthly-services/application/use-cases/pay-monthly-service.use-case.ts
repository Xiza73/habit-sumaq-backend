import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';
import { AccountRepository } from '@modules/accounts/domain/account.repository';
import { TransactionType } from '@modules/transactions/domain/enums/transaction-type.enum';
import { Transaction } from '@modules/transactions/domain/transaction.entity';
import { TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { dayInTimezone } from '../../infrastructure/timezone/day-in-timezone';

import type { PayMonthlyServiceDto } from '../dto/pay-monthly-service.dto';

/**
 * Records a payment for a monthly service.
 *
 * Creates an EXPENSE transaction linked to the service (via `monthlyServiceId`),
 * debits the paying account, advances the service's `lastPaidPeriod` to the
 * period that was just paid, and recomputes `estimatedAmount` as the AVG of
 * the last 3 payments (so the estimate tracks price changes over time).
 */
@Injectable()
export class PayMonthlyServiceUseCase {
  private static readonly MOVING_AVG_WINDOW = 3;

  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly txRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
    @InjectPinoLogger(PayMonthlyServiceUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    id: string,
    userId: string,
    dto: PayMonthlyServiceDto,
    currentPeriod: string,
    timezone: string,
  ): Promise<{ service: MonthlyService; transaction: Transaction }> {
    const service = await this.serviceRepo.findById(id);
    if (!service || service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }

    // Defense-in-depth — the web hides the "Pagar" button when the service
    // is already up-to-date, but a direct API call would otherwise create a
    // duplicate EXPENSE and silently advance `lastPaidPeriod` into the future.
    if (service.isPaidForMonth(currentPeriod)) {
      throw new DomainException(
        'MONTHLY_SERVICE_ALREADY_PAID',
        'El servicio ya está pagado para el mes actual',
      );
    }

    const accountId = dto.accountIdOverride ?? service.defaultAccountId;
    const account = await this.accountRepo.findById(accountId);
    if (!account || account.userId !== userId) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta no encontrada');
    }
    if (String(account.currency) !== service.currency) {
      throw new DomainException(
        'CURRENCY_MISMATCH',
        'La cuenta de pago debe tener la misma moneda que el servicio',
      );
    }

    const paidPeriod = service.nextDuePeriod();
    const now = new Date();
    const date = dto.date ?? now;
    const description = dto.description ?? service.name;

    // Debit the account — monthly-service payments always reduce balance.
    account.debit(dto.amount);
    await this.accountRepo.save(account);

    const transaction = new Transaction(
      randomUUID(),
      userId,
      accountId,
      service.categoryId,
      TransactionType.EXPENSE,
      dto.amount,
      description,
      date,
      null,
      null,
      null,
      null,
      null,
      now,
      now,
      null,
      service.id,
    );

    const savedTx = await this.txRepo.save(transaction);

    // Advance the period pointer and recompute estimates from the last N
    // payments. dueDay tracks the user's payment habit — re-averaging it
    // every time keeps the auto-fill on the pay form (#2.a) accurate without
    // the user editing it manually.
    service.markPeriodAsPaid(paidPeriod);
    const recent = await this.txRepo.findLastNByMonthlyServiceId(
      service.id,
      PayMonthlyServiceUseCase.MOVING_AVG_WINDOW,
    );
    service.estimatedAmount = computeAverageAmount(recent);
    service.dueDay = computeAverageDueDay(recent, timezone) ?? service.dueDay;
    const savedService = await this.serviceRepo.save(service);

    this.logger.info(
      {
        event: 'monthly_service.paid',
        serviceId: savedService.id,
        userId,
        transactionId: savedTx.id,
        amount: dto.amount,
        paidPeriod,
      },
      'monthly_service.paid',
    );

    return { service: savedService, transaction: savedTx };
  }
}

function computeAverageAmount(recent: Transaction[]): number {
  if (recent.length === 0) return 0;
  const sum = recent.reduce((acc, tx) => acc + tx.amount, 0);
  return Math.round((sum / recent.length) * 100) / 100;
}

/**
 * Returns the rounded average day-of-month across `recent` transactions in
 * the user's timezone, or null when there are no transactions to average.
 * The caller decides whether to keep the previous `dueDay` (null result) or
 * update it (numeric result).
 */
function computeAverageDueDay(recent: Transaction[], timezone: string): number | null {
  if (recent.length === 0) return null;
  const days = recent.map((tx) => dayInTimezone(tx.date, timezone));
  const avg = days.reduce((acc, d) => acc + d, 0) / days.length;
  // Clamp to 1..31 — the validation range of the column. Handles edge cases
  // like an empty timezone string falling through to a UTC day of 0.
  return Math.min(31, Math.max(1, Math.round(avg)));
}
