import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { SectionRepository } from '../../domain/section.repository';
import { Task } from '../../domain/task.entity';
import { TaskRepository } from '../../domain/task.repository';

import type { CreateTaskDto } from '../dto/create-task.dto';

/**
 * Creates a task inside a section. Validates section ownership before insert.
 * Position is set to the end of the section's task list.
 */
@Injectable()
export class CreateTaskUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly sectionRepo: SectionRepository,
  ) {}

  async execute(userId: string, dto: CreateTaskDto): Promise<Task> {
    const section = await this.sectionRepo.findById(dto.sectionId);
    if (!section || section.userId !== userId) {
      throw new DomainException('SECTION_NOT_FOUND', 'Sección no encontrada');
    }

    const maxPosition = await this.taskRepo.maxPositionInSection(section.id);
    const now = new Date();
    const task = new Task(
      randomUUID(),
      userId,
      section.id,
      dto.title,
      dto.description ?? null,
      false,
      null,
      (maxPosition ?? 0) + 1,
      now,
      now,
    );
    return this.taskRepo.save(task);
  }
}
