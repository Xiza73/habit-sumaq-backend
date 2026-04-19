import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { QuickTask } from '../../domain/quick-task.entity';
import { QuickTaskRepository } from '../../domain/quick-task.repository';

import type { UpdateQuickTaskDto } from '../dto/update-quick-task.dto';

@Injectable()
export class UpdateQuickTaskUseCase {
  constructor(private readonly taskRepo: QuickTaskRepository) {}

  async execute(id: string, userId: string, dto: UpdateQuickTaskDto): Promise<QuickTask> {
    const task = await this.taskRepo.findById(id);
    if (!task) {
      throw new DomainException('QUICK_TASK_NOT_FOUND', 'Tarea no encontrada');
    }
    if (task.userId !== userId) {
      throw new DomainException(
        'QUICK_TASK_BELONGS_TO_OTHER_USER',
        'No tienes acceso a esta tarea',
      );
    }

    task.applyUpdate(dto);
    return this.taskRepo.save(task);
  }
}
