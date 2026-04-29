import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { Chore } from '../../domain/chore.entity';
import { ChoreRepository } from '../../domain/chore.repository';
import { ChoreLog } from '../../domain/chore-log.entity';
import { ChoreLogRepository } from '../../domain/chore-log.repository';

import type { MarkChoreDoneDto } from '../dto/mark-chore-done.dto';

/**
 * Marks a chore as done:
 *
 * 1. Creates a `ChoreLog` row with the given `doneAt` (default = today in
 *    the user's timezone) and optional note.
 * 2. Updates the chore: `lastDoneDate = doneAt` and `nextDueDate = doneAt +
 *    interval` (rule A — the cadence resets from the actual completion date).
 *
 * The controller is responsible for passing `currentDate` (resolved from the
 * `x-timezone` header) when `dto.doneAt` is omitted.
 */
@Injectable()
export class MarkChoreDoneUseCase {
  constructor(
    private readonly choreRepo: ChoreRepository,
    private readonly logRepo: ChoreLogRepository,
    @InjectPinoLogger(MarkChoreDoneUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    id: string,
    userId: string,
    dto: MarkChoreDoneDto,
    currentDate: string,
  ): Promise<{ chore: Chore; log: ChoreLog }> {
    const chore = await this.choreRepo.findById(id);
    if (!chore || chore.userId !== userId) {
      throw new DomainException('CHORE_NOT_FOUND', 'Tarea no encontrada');
    }

    const doneAt = dto.doneAt ?? currentDate;
    const note = dto.note ?? null;

    const log = new ChoreLog(randomUUID(), chore.id, doneAt, note, new Date());
    const savedLog = await this.logRepo.save(log);

    chore.markDone(doneAt);
    const savedChore = await this.choreRepo.save(chore);

    this.logger.info(
      {
        event: 'chore.done',
        choreId: savedChore.id,
        userId,
        logId: savedLog.id,
        doneAt,
        nextDueDate: savedChore.nextDueDate,
      },
      'chore.done',
    );

    return { chore: savedChore, log: savedLog };
  }
}
