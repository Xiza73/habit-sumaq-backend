import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { TransactionRepository } from '../../domain/transaction.repository';

import type { Transaction } from '../../domain/transaction.entity';

@Injectable()
export class GetTransactionByIdUseCase {
  constructor(private readonly txRepo: TransactionRepository) {}

  async execute(id: string, userId: string): Promise<Transaction> {
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
    return tx;
  }
}
