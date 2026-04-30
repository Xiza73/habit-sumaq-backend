import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { TaskRepository } from '../../domain/task.repository';

@Injectable()
export class DeleteTaskUseCase {
  constructor(private readonly repo: TaskRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    const task = await this.repo.findById(id);
    if (!task || task.userId !== userId) {
      throw new DomainException('TASK_NOT_FOUND', 'Task no encontrada');
    }
    await this.repo.deleteById(id);
  }
}
