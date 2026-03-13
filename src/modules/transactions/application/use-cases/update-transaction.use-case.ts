import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { AccountRepository } from '@modules/accounts/domain/account.repository';

import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
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

    if (tx.isDebtOrLoan() && tx.isSettled() && !amountChanged) {
      throw new DomainException(
        'CANNOT_UPDATE_SETTLED_TRANSACTION',
        'No se puede modificar una transacción liquidada',
      );
    }

    if (amountChanged && tx.isDebtOrLoan()) {
      const settledAmount = tx.amount - (tx.remainingAmount ?? 0);
      if (dto.amount! < settledAmount) {
        throw new DomainException(
          'AMOUNT_BELOW_SETTLED',
          `El nuevo monto no puede ser menor que lo ya liquidado (${settledAmount})`,
        );
      }
      tx.remainingAmount = dto.amount! - settledAmount;
      tx.status = tx.remainingAmount <= 0 ? TransactionStatus.SETTLED : TransactionStatus.PENDING;
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
