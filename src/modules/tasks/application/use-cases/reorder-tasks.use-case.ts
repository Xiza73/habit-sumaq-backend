import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { SectionRepository } from '../../domain/section.repository';
import { TaskRepository } from '../../domain/task.repository';

import type { ReorderTasksDto } from '../dto/reorder-tasks.dto';

/**
 * Reorders tasks inside a single section. The DTO carries the `sectionId`
 * because the drag-and-drop UI is restricted to within-section operations
 * (cross-section moves go through `PATCH /tasks/:id` with a `sectionId`
 * change). Validates that:
 *  1. The section belongs to the user.
 *  2. Every task in `orderedIds` exists, belongs to the user, and is
 *     currently in this section. Cross-section IDs are rejected as invalid.
 */
@Injectable()
export class ReorderTasksUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly sectionRepo: SectionRepository,
  ) {}

  async execute(userId: string, dto: ReorderTasksDto): Promise<void> {
    const section = await this.sectionRepo.findById(dto.sectionId);
    if (!section || section.userId !== userId) {
      throw new DomainException('SECTION_NOT_FOUND', 'Sección no encontrada');
    }

    const tasks = await this.taskRepo.findBySectionId(section.id);
    const ownedIds = new Set(tasks.map((t) => t.id));

    const unknown = dto.orderedIds.filter((id) => !ownedIds.has(id));
    if (unknown.length > 0) {
      throw new DomainException(
        'TASK_REORDER_INVALID_IDS',
        `Las siguientes tasks no existen, no te pertenecen, o no están en esta sección: ${unknown.join(', ')}`,
      );
    }

    const updates = dto.orderedIds.map((id, index) => ({ id, position: index + 1 }));
    await this.taskRepo.updatePositions(updates);
  }
}
