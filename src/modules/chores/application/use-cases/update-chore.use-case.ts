import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Chore } from '../../domain/chore.entity';
import { ChoreRepository } from '../../domain/chore.repository';

import type { UpdateChoreDto } from '../dto/update-chore.dto';

/**
 * Partial update. `startDate` is excluded at the DTO level (it seeds the
 * very first cycle and changing it after the fact would misalign history).
 *
 * Decision firmada: changing `intervalValue` / `intervalUnit` does NOT
 * recompute `nextDueDate`. The user can pass `nextDueDate` explicitly to
 * adjust if needed — keeps behavior predictable.
 */
@Injectable()
export class UpdateChoreUseCase {
  constructor(private readonly choreRepo: ChoreRepository) {}

  async execute(id: string, userId: string, dto: UpdateChoreDto): Promise<Chore> {
    const chore = await this.choreRepo.findById(id);
    if (!chore || chore.userId !== userId) {
      throw new DomainException('CHORE_NOT_FOUND', 'Tarea no encontrada');
    }

    if (dto.name !== undefined) chore.name = dto.name;
    if (dto.notes !== undefined) chore.notes = dto.notes ?? null;
    if (dto.category !== undefined) chore.category = dto.category ?? null;
    if (dto.intervalValue !== undefined) chore.intervalValue = dto.intervalValue;
    if (dto.intervalUnit !== undefined) chore.intervalUnit = dto.intervalUnit;
    if (dto.nextDueDate !== undefined) chore.nextDueDate = dto.nextDueDate;

    chore.updatedAt = new Date();
    return this.choreRepo.save(chore);
  }
}
