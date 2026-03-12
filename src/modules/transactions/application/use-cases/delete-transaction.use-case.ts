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
      for (const s of settlements) {
        await this.reverseBalanceEffect(s);
        await this.txRepo.softDelete(s.id);
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
    const account = await this.accountRepo.findById(tx.accountId);
    if (account) {
      if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.TRANSFER) {
        account.credit(tx.amount);
      } else if (tx.type === TransactionType.INCOME) {
        account.debit(tx.amount);
      }
      await this.accountRepo.save(account);
    }

    if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
      const destAccount = await this.accountRepo.findById(tx.destinationAccountId);
      if (destAccount) {
        destAccount.debit(tx.amount);
        await this.accountRepo.save(destAccount);
      }
    }
  }
}
