import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';

import { Chore } from '../../domain/chore.entity';
import { ChoreRepository } from '../../domain/chore.repository';
import { ChoreLogRepository } from '../../domain/chore-log.repository';

/**
 * Reverts the LAST completion of a chore (undo a mis-mark):
 *
 * 1. Finds the most recent non-deleted `ChoreLog`. None → CHORE_NO_LOGS_TO_REVERT.
 * 2. Soft-deletes that log and re-reads the now-latest log — its `doneAt`
 *    becomes the chore's `lastDoneDate` (or `null` if no log remains). The
 *    chore recomputes `nextDueDate` off that value via `revertLastDone`.
 * 3. Both writes happen inside a single `dataSource.transaction()` so the log
 *    removal and chore rewind commit atomically.
 *
 * Only the LAST event is revertible — arbitrary log deletion is out of scope.
 * Skips (which create no log) are unaffected.
 */
@Injectable()
export class RevertLastChoreDoneUseCase {
  constructor(
    private readonly choreRepo: ChoreRepository,
    private readonly logRepo: ChoreLogRepository,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(RevertLastChoreDoneUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string): Promise<Chore> {
    const chore = await this.choreRepo.findById(id);
    if (!chore || chore.userId !== userId) {
      throw new DomainException('CHORE_NOT_FOUND', 'Tarea no encontrada');
    }

    const latest = await this.logRepo.findLatestByChoreId(id);
    if (!latest) {
      throw new DomainException(
        'CHORE_NO_LOGS_TO_REVERT',
        'La tarea no tiene eventos para revertir',
      );
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      await this.logRepo.softDelete(latest.id, manager);

      // Re-read through the same manager so the row just soft-deleted is
      // already excluded — this yields the completion the chore rolls back to.
      const previous = await this.logRepo.findLatestByChoreId(id, manager);
      chore.revertLastDone(previous ? previous.doneAt : null);

      return this.choreRepo.save(chore, manager);
    });

    this.logger.info(
      {
        event: 'chore.revert_last_done',
        choreId: saved.id,
        userId,
        revertedLogId: latest.id,
        lastDoneDate: saved.lastDoneDate,
        nextDueDate: saved.nextDueDate,
      },
      'chore.revert_last_done',
    );

    return saved;
  }
}
