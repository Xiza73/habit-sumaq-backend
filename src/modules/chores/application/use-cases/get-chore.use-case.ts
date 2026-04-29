import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Chore } from '../../domain/chore.entity';
import { ChoreRepository } from '../../domain/chore.repository';

@Injectable()
export class GetChoreUseCase {
  constructor(private readonly choreRepo: ChoreRepository) {}

  async execute(id: string, userId: string): Promise<Chore> {
    const chore = await this.choreRepo.findById(id);
    // Same 404 for "doesn't exist" and "belongs to someone else" — never leak
    // the existence of another user's data.
    if (!chore || chore.userId !== userId) {
      throw new DomainException('CHORE_NOT_FOUND', 'Tarea no encontrada');
    }
    return chore;
  }
}
