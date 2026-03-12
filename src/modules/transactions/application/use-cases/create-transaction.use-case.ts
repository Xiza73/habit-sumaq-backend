import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { AccountRepository } from '@modules/accounts/domain/account.repository';

import { TransactionStatus } from '../../domain/enums/transaction-status.enum';
import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { Transaction } from '../../domain/transaction.entity';
import { TransactionRepository } from '../../domain/transaction.repository';

import type { CreateTransactionDto } from '../dto/create-transaction.dto';

@Injectable()
export class CreateTransactionUseCase {
  private readonly logger = new Logger(CreateTransactionUseCase.name);

  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
  ) {}

  async execute(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const account = await this.accountRepo.findById(dto.accountId);
    if (!account) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta origen no encontrada');
    }
    if (account.userId !== userId) {
      throw new DomainException('ACCOUNT_BELONGS_TO_OTHER_USER', 'No tienes acceso a esta cuenta');
    }

    const isDebtOrLoan = dto.type === TransactionType.DEBT || dto.type === TransactionType.LOAN;

    if (isDebtOrLoan) {
      if (!dto.reference) {
        throw new DomainException(
          'REFERENCE_REQUIRED',
          'Las deudas y préstamos requieren un campo reference',
        );
      }
      // DEBT/LOAN do NOT affect balance
    } else if (dto.type === TransactionType.TRANSFER) {
      if (!dto.destinationAccountId) {
        throw new DomainException(
          'TRANSFER_DESTINATION_REQUIRED',
          'Las transferencias requieren una cuenta destino',
        );
      }
      if (dto.accountId === dto.destinationAccountId) {
        throw new DomainException(
          'TRANSFER_SAME_ACCOUNT',
          'No puedes transferir a la misma cuenta',
        );
      }

      const destAccount = await this.accountRepo.findById(dto.destinationAccountId);
      if (!destAccount) {
        throw new DomainException('DESTINATION_ACCOUNT_NOT_FOUND', 'Cuenta destino no encontrada');
      }
      if (destAccount.userId !== userId) {
        throw new DomainException(
          'ACCOUNT_BELONGS_TO_OTHER_USER',
          'No tienes acceso a la cuenta destino',
        );
      }
      if (account.currency !== destAccount.currency) {
        throw new DomainException(
          'TRANSFER_CURRENCY_MISMATCH',
          'Las cuentas deben tener la misma moneda para transferir',
        );
      }

      account.debit(dto.amount);
      destAccount.credit(dto.amount);
      await this.accountRepo.save(account);
      await this.accountRepo.save(destAccount);
    } else if (dto.type === TransactionType.EXPENSE) {
      account.debit(dto.amount);
      await this.accountRepo.save(account);
    } else {
      // INCOME
      account.credit(dto.amount);
      await this.accountRepo.save(account);
    }

    const now = new Date();
    const transaction = new Transaction(
      randomUUID(),
      userId,
      dto.accountId,
      dto.categoryId ?? null,
      dto.type,
      dto.amount,
      dto.description ?? null,
      dto.date,
      dto.destinationAccountId ?? null,
      dto.reference ?? null,
      isDebtOrLoan ? TransactionStatus.PENDING : null,
      null,
      isDebtOrLoan ? dto.amount : null,
      now,
      now,
      null,
    );

    const saved = await this.txRepo.save(transaction);
    this.logger.log(
      `Transacción creada: id=${saved.id} tipo=${dto.type} monto=${dto.amount} cuenta=${dto.accountId}`,
    );
    return saved;
  }
}
