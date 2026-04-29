import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { ChoreRepository } from '../../domain/chore.repository';
import { ChoreLogRepository } from '../../domain/chore-log.repository';

/**
 * Soft-deletes a chore — but only if it has no logs. Chores with logs must
 * be archived instead so the history stays meaningful (a deleted chore would
 * leave dangling logs the user can no longer inspect).
 */
@Injectable()
export class DeleteChoreUseCase {
  constructor(
    private readonly choreRepo: ChoreRepository,
    private readonly logRepo: ChoreLogRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const chore = await this.choreRepo.findById(id);
    if (!chore || chore.userId !== userId) {
      throw new DomainException('CHORE_NOT_FOUND', 'Tarea no encontrada');
    }

    const logCount = await this.logRepo.countByChoreId(id);
    if (logCount > 0) {
      throw new DomainException(
        'CHORE_HAS_LOGS',
        'No se puede eliminar una tarea con eventos registrados. Archivala en su lugar.',
      );
    }

    await this.choreRepo.softDelete(id);
  }
}
