import { Injectable, Logger } from '@nestjs/common';

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
  private readonly logger = new Logger(BulkSettleByReferenceUseCase.name);

  constructor(private readonly txRepo: TransactionRepository) {}

  async execute(userId: string, reference: string): Promise<BulkSettleResult> {
    const pending = await this.txRepo.findPendingDebtOrLoanByNormalizedReference(userId, reference);

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

    this.logger.log(
      `Bulk settle: userId=${userId} reference="${reference}" count=${pending.length} totalSettled=${totalSettled}`,
    );

    return { settledIds, totalSettled, count: pending.length };
  }
}
