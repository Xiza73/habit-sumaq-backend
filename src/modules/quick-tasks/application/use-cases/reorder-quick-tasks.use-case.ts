import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { QuickTaskRepository } from '../../domain/quick-task.repository';

import type { ReorderQuickTasksDto } from '../dto/reorder-quick-tasks.dto';

@Injectable()
export class ReorderQuickTasksUseCase {
  constructor(private readonly taskRepo: QuickTaskRepository) {}

  async execute(userId: string, dto: ReorderQuickTasksDto): Promise<void> {
    // Load the user's tasks to validate ownership of every id in the payload.
    const tasks = await this.taskRepo.findByUserId(userId);
    const ownedIds = new Set(tasks.map((t) => t.id));

    const unknown = dto.orderedIds.filter((id) => !ownedIds.has(id));
    if (unknown.length > 0) {
      throw new DomainException(
        'QUICK_TASK_REORDER_INVALID_IDS',
        `Las siguientes tareas no existen o no te pertenecen: ${unknown.join(', ')}`,
      );
    }

    // Renumber 1..N in the order provided. Tasks not in the payload keep their
    // current position — callers are expected to send the full ordered list,
    // but partial updates still succeed without ghost positions.
    const updates = dto.orderedIds.map((id, index) => ({ id, position: index + 1 }));
    await this.taskRepo.updatePositions(userId, updates);
  }
}
