import { Injectable } from '@nestjs/common';

import { Chore } from '../../domain/chore.entity';
import { ChoreRepository } from '../../domain/chore.repository';

@Injectable()
export class ListChoresUseCase {
  constructor(private readonly choreRepo: ChoreRepository) {}

  async execute(userId: string, includeArchived: boolean): Promise<Chore[]> {
    return this.choreRepo.findByUserId(userId, includeArchived);
  }
}
