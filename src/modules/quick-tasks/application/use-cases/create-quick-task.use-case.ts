import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { QuickTask } from '../../domain/quick-task.entity';
import { QuickTaskRepository } from '../../domain/quick-task.repository';

import type { CreateQuickTaskDto } from '../dto/create-quick-task.dto';

@Injectable()
export class CreateQuickTaskUseCase {
  constructor(
    private readonly taskRepo: QuickTaskRepository,
    @InjectPinoLogger(CreateQuickTaskUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(userId: string, dto: CreateQuickTaskDto): Promise<QuickTask> {
    const maxPosition = await this.taskRepo.maxPositionByUserId(userId);
    const nextPosition = (maxPosition ?? 0) + 1;

    const now = new Date();
    const task = new QuickTask(
      randomUUID(),
      userId,
      dto.title,
      dto.description ?? null,
      false,
      null,
      nextPosition,
      now,
      now,
    );

    const saved = await this.taskRepo.save(task);
    this.logger.info(
      { event: 'quick_task.created', taskId: saved.id, userId },
      'quick_task.created',
    );
    return saved;
  }
}
