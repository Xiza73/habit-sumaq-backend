import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { QuickTaskRepository } from '../../domain/quick-task.repository';

@Injectable()
export class DeleteQuickTaskUseCase {
  constructor(private readonly taskRepo: QuickTaskRepository) {}

  async execute(id: string, userId: string): Promise<void> {
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

    await this.taskRepo.deleteById(id);
  }
}
