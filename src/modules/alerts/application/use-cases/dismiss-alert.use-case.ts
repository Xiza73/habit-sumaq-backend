import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { isDismissable } from '../../domain/alert-dismiss-policy';
import { typeFromAlertId } from '../../domain/alert-id';
import { UserAlertDismissal } from '../../domain/user-alert-dismissal.entity';
import { UserAlertDismissalRepository } from '../../domain/user-alert-dismissal.repository';
import { endOfDayInTimezone } from '../../infrastructure/timezone/end-of-day-in-timezone';

/**
 * Records a per-day dismiss for an alert. Rejects with `ALR_001` when the
 * alert's type is `persistent` — the frontend doesn't show a "Cerrar" button
 * for those, but we enforce server-side too so a misbehaving client can't
 * insert a dead-row that hides a real alert forever.
 *
 * `expiresAt` = midnight in the user's TZ at the time of the dismiss. Once
 * that instant passes, `GetAlertsForUserUseCase` treats the row as stale
 * and the alert resurfaces (if the underlying condition still applies).
 */
@Injectable()
export class DismissAlertUseCase {
  constructor(
    private readonly dismissalsRepo: UserAlertDismissalRepository,
    private readonly userSettingsRepo: UserSettingsRepository,
  ) {}

  async execute(userId: string, alertId: string, now: Date = new Date()): Promise<void> {
    const type = typeFromAlertId(alertId);
    if (type === null || !isDismissable(type)) {
      throw new DomainException(
        'ALERT_NOT_DISMISSABLE',
        'Esta alerta no se puede cerrar manualmente — desaparece al resolverse',
      );
    }

    // Pull the user's TZ so the expiry lands at THEIR midnight, not the
    // server's. Fallback `'UTC'` mirrors the rest of the codebase.
    const settings = await this.userSettingsRepo.findByUserId(userId);
    const timezone = settings?.timezone ?? 'UTC';
    const expiresAt = endOfDayInTimezone(timezone, now);

    await this.dismissalsRepo.upsert(
      new UserAlertDismissal(
        // Repo's upsert keys on `(userId, alertId)` so the id passed here
        // is only used on first insert. Random UUID keeps the column happy
        // without coupling the use case to PG's `gen_random_uuid()`.
        randomUUID(),
        userId,
        alertId,
        now,
        expiresAt,
      ),
    );
  }
}
