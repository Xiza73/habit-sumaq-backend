import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TransactionRepository } from '../../domain/transaction.repository';

export interface BulkSettleResult {
  settledIds: string[];
  totalSettled: number;
  count: number;
}

/**
 * Marks ALL pending DEBT/LOAN transactions matching a normalized reference as
 * SETTLED. Does NOT create settlement transactions nor affect account balances.
 * Semantics: "we sorted this out informally, close the books on this person".
 * For a real payment with cash-flow tracking, use SettleTransactionUseCase.
 *
 * Idempotent: returns count=0 if the reference has no pending tx.
 */
@Injectable()
export class BulkSettleByReferenceUseCase {
  constructor(
    private readonly txRepo: TransactionRepository,
    @InjectPinoLogger(BulkSettleByReferenceUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(userId: string, reference: string, currency?: string): Promise<BulkSettleResult> {
    const pending = await this.txRepo.findPendingDebtOrLoanByNormalizedReference(
      userId,
      reference,
      currency,
    );

    if (pending.length === 0) {
      return { settledIds: [], totalSettled: 0, count: 0 };
    }

    const settledIds: string[] = [];
    let totalSettled = 0;

    for (const tx of pending) {
      const remaining = tx.remainingAmount ?? 0;
      totalSettled += remaining;
      tx.applySettlement(remaining);
      await this.txRepo.save(tx);
      settledIds.push(tx.id);
    }

    this.logger.info(
      {
        event: 'transaction.bulk_settle',
        userId,
        currency: currency ?? 'ALL',
        count: pending.length,
        totalSettled,
      },
      'transaction.bulk_settle',
    );

    return { settledIds, totalSettled, count: pending.length };
  }
}
