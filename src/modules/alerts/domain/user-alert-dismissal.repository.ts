import type { UserAlertDismissal } from './user-alert-dismissal.entity';

export abstract class UserAlertDismissalRepository {
  /**
   * Every dismissal for this user. Caller filters by `isActiveAt(now)`.
   * We deliberately return ALL rows (active + stale) instead of pushing
   * the "not expired" predicate into SQL — keeps the repo dumb and lets
   * the use case sit on top of one canonical clock.
   */
  abstract findByUserId(userId: string): Promise<UserAlertDismissal[]>;

  /**
   * Upsert by `(userId, alertId)` — if the row already exists, refresh
   * `dismissedAt` + `expiresAt` instead of inserting a duplicate. The
   * underlying ORM column has a `UNIQUE(userId, alertId)` constraint, so
   * a naive insert would error on the second dismiss of the same alert.
   */
  abstract upsert(dismissal: UserAlertDismissal): Promise<UserAlertDismissal>;
}
