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

    // Reverse balance effect
    const account = await this.accountRepo.findById(tx.accountId);
    if (account) {
      if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.TRANSFER) {
        account.credit(tx.amount);
      } else {
        account.debit(tx.amount);
      }
      await this.accountRepo.save(account);
    }

    // For transfers, also reverse destination
    if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
      const destAccount = await this.accountRepo.findById(tx.destinationAccountId);
      if (destAccount) {
        destAccount.debit(tx.amount);
        await this.accountRepo.save(destAccount);
      }
    }

    await this.txRepo.softDelete(id);
  }
}
