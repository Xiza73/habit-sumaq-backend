import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { Chore } from '../../domain/chore.entity';
import { ChoreRepository } from '../../domain/chore.repository';

import type { CreateChoreDto } from '../dto/create-chore.dto';

@Injectable()
export class CreateChoreUseCase {
  constructor(
    private readonly choreRepo: ChoreRepository,
    @InjectPinoLogger(CreateChoreUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(userId: string, dto: CreateChoreDto): Promise<Chore> {
    // Plan rule 1: nextDueDate seeds to startDate; lastDoneDate stays null.
    const now = new Date();
    const chore = new Chore(
      randomUUID(),
      userId,
      dto.name,
      dto.notes ?? null,
      dto.category ?? null,
      dto.intervalValue,
      dto.intervalUnit,
      dto.startDate,
      null,
      dto.startDate,
      true,
      now,
      now,
      null,
    );

    const saved = await this.choreRepo.save(chore);
    this.logger.info(
      {
        event: 'chore.created',
        choreId: saved.id,
        userId,
        name: saved.name,
        intervalValue: saved.intervalValue,
        intervalUnit: saved.intervalUnit,
        startDate: saved.startDate,
      },
      'chore.created',
    );
    return saved;
  }
}
