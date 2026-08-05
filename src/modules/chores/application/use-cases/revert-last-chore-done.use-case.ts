import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';

import { Chore } from '../../domain/chore.entity';
import { ChoreRepository } from '../../domain/chore.repository';
import { ChoreLogRepository } from '../../domain/chore-log.repository';

/**
 * Reverts the LAST completion of a chore (undo a mis-mark). The ENTIRE
 * read-decide-write sequence runs inside a single `dataSource.transaction()`:
 *
 * 1. Re-fetch the chore THROUGH the tx manager with a `pessimistic_write` row
 *    lock (`findByIdForUpdate`), then verify ownership + not-deleted.
 * 2. Find the most recent non-deleted `ChoreLog` (via the manager). None →
 *    CHORE_NO_LOGS_TO_REVERT (rolls the tx back).
 * 3. Soft-delete that log and re-read the now-latest log — its `doneAt`
 *    becomes the chore's `lastDoneDate` (or `null` if no log remains). The
 *    chore recomputes `nextDueDate` off that value via `revertLastDone`, then
 *    is saved through the manager.
 *
 * **Concurrency (lost update / clobber)**: the chore row lock serializes two
 * concurrent or duplicate reverts (double-tap, retry) on the same chore. Read
 * unlocked and BEFORE the transaction — the previous shape — both callers
 * captured the same `latest` log and the same stale chore snapshot: the second
 * soft-delete was a silent no-op re-stamp, the second revert failed to unwind
 * the next log, and `choreRepo.save` blind-overwrote the whole row from the
 * stale snapshot, clobbering any concurrent PATCH / mark-done / skip. Holding
 * `SELECT ... FOR UPDATE` for the tx means the second revert blocks until the
 * first commits, then re-reads the already-updated state and correctly unwinds
 * the next log — same defense the debts-loans `SettleAmountByReferenceUseCase`
 * and `CurrencyPoolService` apply on their money rows.
 *
 * Only the LAST event is revertible — arbitrary log deletion is out of scope.
 * Skips create no log, so a skip performed after the last done is not
 * reconstructed: `nextDueDate` is recomputed purely from the completion
 * history, discarding that skip's advancement.
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
    const { chore, revertedLogId } = await this.dataSource.transaction(async (manager) => {
      // Locked re-fetch INSIDE the tx: serializes concurrent reverts on this
      // chore and gives us a fresh snapshot to save (see class docblock).
      const locked = await this.choreRepo.findByIdForUpdate(id, manager);
      if (!locked || locked.userId !== userId) {
        throw new DomainException('CHORE_NOT_FOUND', 'Tarea no encontrada');
      }

      const latest = await this.logRepo.findLatestByChoreId(id, manager);
      if (!latest) {
        throw new DomainException(
          'CHORE_NO_LOGS_TO_REVERT',
          'La tarea no tiene eventos para revertir',
        );
      }

      await this.logRepo.softDelete(latest.id, manager);

      // Re-read through the same manager so the row just soft-deleted is
      // already excluded — this yields the completion the chore rolls back to.
      const previous = await this.logRepo.findLatestByChoreId(id, manager);
      locked.revertLastDone(previous ? previous.doneAt : null);

      const saved = await this.choreRepo.save(locked, manager);
      return { chore: saved, revertedLogId: latest.id };
    });

    this.logger.info(
      {
        event: 'chore.revert_last_done',
        choreId: chore.id,
        userId,
        revertedLogId,
        lastDoneDate: chore.lastDoneDate,
        nextDueDate: chore.nextDueDate,
      },
      'chore.revert_last_done',
    );

    return chore;
  }
}
