import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';
import { AccountRepository } from '@modules/accounts/domain/account.repository';

import { TransactionType } from '../../domain/enums/transaction-type.enum';
import { Transaction } from '../../domain/transaction.entity';
import { TransactionRepository } from '../../domain/transaction.repository';

import type { SettleTransactionDto } from '../dto/settle-transaction.dto';

@Injectable()
export class SettleTransactionUseCase {
  constructor(
    private readonly txRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
    @InjectPinoLogger(SettleTransactionUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string, dto: SettleTransactionDto): Promise<Transaction> {
    const original = await this.txRepo.findById(id);
    if (!original) {
      throw new DomainException('TRANSACTION_NOT_FOUND', 'Transacción no encontrada');
    }
    if (original.userId !== userId) {
      throw new DomainException(
        'TRANSACTION_BELONGS_TO_OTHER_USER',
        'No tienes acceso a esta transacción',
      );
    }
    if (!original.isDebtOrLoan()) {
      throw new DomainException(
        'TRANSACTION_NOT_DEBT_OR_LOAN',
        'Solo se pueden liquidar transacciones de tipo DEBT o LOAN',
      );
    }
    if (original.isSettled()) {
      throw new DomainException(
        'TRANSACTION_ALREADY_SETTLED',
        'La deuda/préstamo ya fue liquidada completamente',
      );
    }
    if (dto.amount > (original.remainingAmount ?? 0)) {
      throw new DomainException(
        'SETTLEMENT_AMOUNT_EXCEEDS_REMAINING',
        'El monto excede el saldo pendiente',
      );
    }

    const account = await this.accountRepo.findById(dto.accountId);
    if (!account) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta no encontrada');
    }
    if (account.userId !== userId) {
      throw new DomainException('ACCOUNT_BELONGS_TO_OTHER_USER', 'No tienes acceso a esta cuenta');
    }

    // DEBT → pagar deuda → EXPENSE (debit account)
    // LOAN → cobrar préstamo → INCOME (credit account)
    const settlementType =
      original.type === TransactionType.DEBT ? TransactionType.EXPENSE : TransactionType.INCOME;

    if (settlementType === TransactionType.EXPENSE) {
      account.debit(dto.amount);
    } else {
      account.credit(dto.amount);
    }
    await this.accountRepo.save(account);

    const defaultDescription =
      original.type === TransactionType.DEBT
        ? `Pago de deuda: ${original.description ?? original.reference}`
        : `Cobro de préstamo: ${original.description ?? original.reference}`;

    const now = new Date();
    const settlement = new Transaction(
      randomUUID(),
      userId,
      dto.accountId,
      original.categoryId,
      settlementType,
      dto.amount,
      dto.description ?? defaultDescription,
      dto.date ?? now,
      null,
      original.reference,
      null,
      original.id,
      null,
      now,
      now,
      null,
    );

    const savedSettlement = await this.txRepo.save(settlement);

    original.applySettlement(dto.amount);
    await this.txRepo.save(original);

    this.logger.info(
      {
        event: 'transaction.settled',
        settlementId: savedSettlement.id,
        originalTransactionId: original.id,
        userId,
        amount: dto.amount,
        remaining: original.remainingAmount,
      },
      'transaction.settled',
    );

    return savedSettlement;
  }
}
