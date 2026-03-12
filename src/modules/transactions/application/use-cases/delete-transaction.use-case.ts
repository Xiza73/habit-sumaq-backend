import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { AccountRepository } from '@modules/accounts/domain/account.repository';

import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { TransactionRepository } from '../../domain/transaction.repository';

@Injectable()
export class DeleteTransactionUseCase {
  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const tx = await this.txRepo.findById(id);
    if (!tx) {
      throw new DomainException('TRANSACTION_NOT_FOUND', 'Transacción no encontrada');
    }
    if (tx.userId !== userId) {
      throw new DomainException(
        'TRANSACTION_BELONGS_TO_OTHER_USER',
        'No tienes acceso a esta transacción',
      );
    }

    // If it's a DEBT/LOAN, cascade delete all settlements and reverse their balances
    if (tx.isDebtOrLoan()) {
      const settlements = await this.txRepo.findByRelatedTransactionId(tx.id);

      if (settlements.length > 0) {
        // Batch-load all affected accounts to avoid N+1
        const accountIds = new Set<string>();
        for (const s of settlements) {
          accountIds.add(s.accountId);
          if (s.destinationAccountId) accountIds.add(s.destinationAccountId);
        }
        const accounts = await this.accountRepo.findByIds([...accountIds]);
        const accountMap = new Map(accounts.map((a) => [a.id, a]));

        for (const s of settlements) {
          this.reverseBalanceEffectInMemory(s, accountMap);
        }

        // Save all modified accounts and soft-delete all settlements
        await Promise.all([
          ...accounts.map((a) => this.accountRepo.save(a)),
          ...settlements.map((s) => this.txRepo.softDelete(s.id)),
        ]);
      }

      // DEBT/LOAN itself never affected balance, just soft delete
      await this.txRepo.softDelete(id);
      return;
    }

    // If it's a settlement (has relatedTransactionId), revert the original DEBT/LOAN
    if (tx.relatedTransactionId) {
      const original = await this.txRepo.findById(tx.relatedTransactionId);
      if (original) {
        original.revertSettlement(tx.amount);
        await this.txRepo.save(original);
      }
    }

    // Reverse balance effect for regular transactions and settlements
    await this.reverseBalanceEffect(tx);
    await this.txRepo.softDelete(id);
  }

  private async reverseBalanceEffect(tx: {
    type: TransactionType;
    accountId: string;
    amount: number;
    destinationAccountId: string | null;
  }): Promise<void> {
    const ids = [tx.accountId];
    if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
      ids.push(tx.destinationAccountId);
    }

    const accounts = await this.accountRepo.findByIds(ids);
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    this.reverseBalanceEffectInMemory(tx, accountMap);

    await Promise.all(accounts.map((a) => this.accountRepo.save(a)));
  }

  private reverseBalanceEffectInMemory(
    tx: {
      type: TransactionType;
      accountId: string;
      amount: number;
      destinationAccountId: string | null;
    },
    accountMap: Map<string, { credit(amount: number): void; debit(amount: number): void }>,
  ): void {
    const account = accountMap.get(tx.accountId);
    if (account) {
      if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.TRANSFER) {
        account.credit(tx.amount);
      } else if (tx.type === TransactionType.INCOME) {
        account.debit(tx.amount);
      }
    }

    if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
      const destAccount = accountMap.get(tx.destinationAccountId);
      if (destAccount) {
        destAccount.debit(tx.amount);
      }
    }
  }
}
