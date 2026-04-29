import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { Chore } from '../../domain/chore.entity';
import { ChoreRepository } from '../../domain/chore.repository';

/**
 * Pushes `nextDueDate` forward by one interval without creating a log and
 * without touching `lastDoneDate`. Use case: the user wants to defer the
 * chore one cycle without claiming they did it.
 */
@Injectable()
export class SkipChoreCycleUseCase {
  constructor(
    private readonly choreRepo: ChoreRepository,
    @InjectPinoLogger(SkipChoreCycleUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string): Promise<Chore> {
    const chore = await this.choreRepo.findById(id);
    if (!chore || chore.userId !== userId) {
      throw new DomainException('CHORE_NOT_FOUND', 'Tarea no encontrada');
    }

    const previousNextDue = chore.nextDueDate;
    chore.skipCycle();
    const saved = await this.choreRepo.save(chore);

    this.logger.info(
      {
        event: 'chore.skipped',
        choreId: saved.id,
        userId,
        previousNextDue,
        nextDueDate: saved.nextDueDate,
      },
      'chore.skipped',
    );
    return saved;
  }
}
