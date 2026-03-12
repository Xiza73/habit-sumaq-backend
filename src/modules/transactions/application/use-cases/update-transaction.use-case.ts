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

    if (tx.isDebtOrLoan() && tx.isSettled()) {
      throw new DomainException(
        'CANNOT_UPDATE_SETTLED_TRANSACTION',
        'No se puede modificar una transacción liquidada',
      );
    }

    const amountChanged = dto.amount !== undefined && dto.amount !== tx.amount;

    if (amountChanged && tx.isDebtOrLoan()) {
      // For DEBT/LOAN: update remainingAmount proportionally
      const diff = dto.amount! - tx.amount;
      tx.remainingAmount = (tx.remainingAmount ?? 0) + diff;
      if (tx.remainingAmount < 0) tx.remainingAmount = 0;
    } else if (amountChanged) {
      const isTransfer = tx.type === TransactionType.TRANSFER && tx.destinationAccountId;

      // Load source and destination accounts in parallel
      const [account, destAccount] = await Promise.all([
        this.accountRepo.findById(tx.accountId),
        isTransfer ? this.accountRepo.findById(tx.destinationAccountId!) : Promise.resolve(null),
      ]);

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

      // For transfers, also adjust destination account
      if (destAccount) {
        destAccount.debit(tx.amount); // reverse old credit
        destAccount.credit(newAmount); // apply new credit
      }

      await Promise.all([
        this.accountRepo.save(account),
        destAccount ? this.accountRepo.save(destAccount) : Promise.resolve(undefined),
      ]);
    }

    if (dto.amount !== undefined) tx.amount = dto.amount;
    if (dto.categoryId !== undefined) tx.categoryId = dto.categoryId ?? null;
    if (dto.description !== undefined) tx.description = dto.description ?? null;
    if (dto.date !== undefined) tx.date = dto.date;
    if (dto.reference !== undefined) tx.reference = dto.reference ?? null;
    tx.updatedAt = new Date();

    return this.txRepo.save(tx);
  }
}
