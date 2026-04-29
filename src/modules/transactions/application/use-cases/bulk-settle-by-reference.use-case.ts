import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';
import { AccountRepository } from '@modules/accounts/domain/account.repository';

import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { Transaction } from '../../domain/transaction.entity';
import { TransactionRepository } from '../../domain/transaction.repository';

export interface BulkSettleResult {
  settledIds: string[];
  totalSettled: number;
  count: number;
  /** New settlement transactions created when running in "real payment" mode. Empty in informal mode. */
  settlementIds: string[];
}

/**
 * Bulk-settles all pending DEBT/LOAN transactions matching a normalized
 * reference. Two modes:
 *
 *  - **Informal close** (no `accountId`) — marks the originals as SETTLED.
 *    Does NOT create settlement transactions nor touch any account balance.
 *    Semantics: "we sorted this out face-to-face, close the books".
 *
 *  - **Real payment** (with `accountId`) — for each pending tx, creates a
 *    settlement transaction (EXPENSE for DEBT, INCOME for LOAN) on the given
 *    account, debits/credits accordingly, then marks the original as SETTLED.
 *    Mirrors `SettleTransactionUseCase` applied N times in a single shot.
 *
 * Idempotent: returns count=0 if the reference has no pending tx.
 */
@Injectable()
export class BulkSettleByReferenceUseCase {
  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
    @InjectPinoLogger(BulkSettleByReferenceUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    userId: string,
    reference: string,
    currency?: string,
    accountId?: string,
  ): Promise<BulkSettleResult> {
    const pending = await this.txRepo.findPendingDebtOrLoanByNormalizedReference(
      userId,
      reference,
      currency,
    );

    if (pending.length === 0) {
      return { settledIds: [], totalSettled: 0, count: 0, settlementIds: [] };
    }

    // ── Real payment mode: validate the account once, then loop. ─────────
    if (accountId) {
      const account = await this.accountRepo.findById(accountId);
      if (!account) {
        throw new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta no encontrada');
      }
      if (account.userId !== userId) {
        throw new DomainException(
          'ACCOUNT_BELONGS_TO_OTHER_USER',
          'No tienes acceso a esta cuenta',
        );
      }
      // Currency safety net — the caller filters `pending` by currency, but if
      // the account doesn't match we'd otherwise debit/credit silently in the
      // wrong currency. Reject upfront with a clean domain error.
      if (currency && String(account.currency) !== currency) {
        throw new DomainException(
          'CURRENCY_MISMATCH',
          'La cuenta de pago debe tener la misma moneda que las deudas/préstamos a liquidar',
        );
      }

      const settledIds: string[] = [];
      const settlementIds: string[] = [];
      let totalSettled = 0;

      for (const tx of pending) {
        const remaining = tx.remainingAmount ?? 0;
        if (remaining <= 0) continue;

        const settlementType =
          tx.type === TransactionType.DEBT ? TransactionType.EXPENSE : TransactionType.INCOME;

        if (settlementType === TransactionType.EXPENSE) {
          account.debit(remaining);
        } else {
          account.credit(remaining);
        }

        const description =
          tx.type === TransactionType.DEBT
            ? `Pago de deuda: ${tx.description ?? tx.reference ?? ''}`.trim()
            : `Cobro de préstamo: ${tx.description ?? tx.reference ?? ''}`.trim();

        const now = new Date();
        const settlement = new Transaction(
          randomUUID(),
          userId,
          accountId,
          tx.categoryId,
          settlementType,
          remaining,
          description,
          now,
          null,
          tx.reference,
          null,
          tx.id,
          null,
          now,
          now,
          null,
        );
        const savedSettlement = await this.txRepo.save(settlement);
        settlementIds.push(savedSettlement.id);

        tx.applySettlement(remaining);
        await this.txRepo.save(tx);

        totalSettled += remaining;
        settledIds.push(tx.id);
      }

      // One save per loop iteration touches `account` in memory; persist the
      // final balance once at the end (TypeORM merges intermediate state).
      await this.accountRepo.save(account);

      this.logger.info(
        {
          event: 'transaction.bulk_settle_real',
          userId,
          accountId,
          currency: currency ?? null,
          count: settledIds.length,
          totalSettled,
          settlementIds,
        },
        'transaction.bulk_settle_real',
      );

      return {
        settledIds,
        totalSettled,
        count: settledIds.length,
        settlementIds,
      };
    }

    // ── Informal close mode: mark SETTLED without any cash flow. ─────────
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
        event: 'transaction.bulk_settle_informal',
        userId,
        currency: currency ?? 'ALL',
        count: pending.length,
        totalSettled,
      },
      'transaction.bulk_settle_informal',
    );

    return {
      settledIds,
      totalSettled,
      count: pending.length,
      settlementIds: [],
    };
  }
}
