import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { ChoreRepository } from '../../domain/chore.repository';
import { ChoreLog } from '../../domain/chore-log.entity';
import { ChoreLogRepository } from '../../domain/chore-log.repository';

@Injectable()
export class ListChoreLogsUseCase {
  constructor(
    private readonly choreRepo: ChoreRepository,
    private readonly logRepo: ChoreLogRepository,
  ) {}

  async execute(
    choreId: string,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: ChoreLog[]; total: number }> {
    // Ownership check first — never leak logs of someone else's chore.
    const chore = await this.choreRepo.findById(choreId);
    if (!chore || chore.userId !== userId) {
      throw new DomainException('CHORE_NOT_FOUND', 'Tarea no encontrada');
    }

    return this.logRepo.findByChoreId(choreId, limit, offset);
  }
}
