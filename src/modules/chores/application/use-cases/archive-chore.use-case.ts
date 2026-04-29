import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Chore } from '../../domain/chore.entity';
import { ChoreRepository } from '../../domain/chore.repository';

/**
 * Toggles `isActive`. Archiving a chore does NOT delete its logs — the
 * history is preserved so the user can review past completions even when
 * the chore is no longer active.
 */
@Injectable()
export class ArchiveChoreUseCase {
  constructor(private readonly choreRepo: ChoreRepository) {}

  async execute(id: string, userId: string): Promise<Chore> {
    const chore = await this.choreRepo.findById(id);
    if (!chore || chore.userId !== userId) {
      throw new DomainException('CHORE_NOT_FOUND', 'Tarea no encontrada');
    }

    chore.toggleActive();
    return this.choreRepo.save(chore);
  }
}
