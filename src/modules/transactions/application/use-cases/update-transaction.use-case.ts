import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { AccountRepository } from '@modules/accounts/domain/account.repository';

import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { TransactionRepository } from '../../domain/transaction.repository';

import type { Transaction } from '../../domain/transaction.entity';
import type { UpdateTransactionDto } from '../dto/update-transaction.dto';

@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
  ) {}

  async execute(id: string, userId: string, dto: UpdateTransactionDto): Promise<Transaction> {
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

    const amountChanged = dto.amount !== undefined && dto.amount !== tx.amount;

    if (amountChanged) {
      const account = await this.accountRepo.findById(tx.accountId);
      if (!account) {
        throw new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta asociada no encontrada');
      }

      // Reverse old effect
      if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.TRANSFER) {
        account.credit(tx.amount);
      } else {
        account.debit(tx.amount);
      }

      // Apply new effect
      const newAmount = dto.amount!;
      if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.TRANSFER) {
        account.debit(newAmount);
      } else {
        account.credit(newAmount);
      }

      await this.accountRepo.save(account);

      // For transfers, also adjust destination account
      if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
        const destAccount = await this.accountRepo.findById(tx.destinationAccountId);
        if (destAccount) {
          destAccount.debit(tx.amount); // reverse old credit
          destAccount.credit(newAmount); // apply new credit
          await this.accountRepo.save(destAccount);
        }
      }
    }

    if (dto.amount !== undefined) tx.amount = dto.amount;
    if (dto.categoryId !== undefined) tx.categoryId = dto.categoryId ?? null;
    if (dto.description !== undefined) tx.description = dto.description ?? null;
    if (dto.date !== undefined) tx.date = dto.date;
    tx.updatedAt = new Date();

    return this.txRepo.save(tx);
  }
}
