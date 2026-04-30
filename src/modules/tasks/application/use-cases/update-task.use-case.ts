import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { SectionRepository } from '../../domain/section.repository';
import { Task } from '../../domain/task.entity';
import { TaskRepository } from '../../domain/task.repository';

import type { UpdateTaskDto } from '../dto/update-task.dto';

/**
 * Updates a task's editable fields. Special handling for cross-section moves
 * (`sectionId` changing): the new section must belong to the user, and the
 * task is moved to the END of the new section. The old section's positions
 * are NOT renumbered — gaps are fine, the next reorder fixes them.
 *
 * Toggle of `completed` sets/clears `completedAt` automatically (handled in
 * the entity's `applyUpdate`).
 */
@Injectable()
export class UpdateTaskUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly sectionRepo: SectionRepository,
  ) {}

  async execute(id: string, userId: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.taskRepo.findById(id);
    if (!task || task.userId !== userId) {
      throw new DomainException('TASK_NOT_FOUND', 'Task no encontrada');
    }

    let newPosition: number | undefined;
    if (dto.sectionId !== undefined && dto.sectionId !== task.sectionId) {
      const newSection = await this.sectionRepo.findById(dto.sectionId);
      if (!newSection || newSection.userId !== userId) {
        throw new DomainException('SECTION_NOT_FOUND', 'Sección de destino no encontrada');
      }
      const maxPosition = await this.taskRepo.maxPositionInSection(newSection.id);
      newPosition = (maxPosition ?? 0) + 1;
    }

    task.applyUpdate({
      title: dto.title,
      description: dto.description,
      completed: dto.completed,
      sectionId: dto.sectionId,
      position: newPosition,
    });

    return this.taskRepo.save(task);
  }
}
