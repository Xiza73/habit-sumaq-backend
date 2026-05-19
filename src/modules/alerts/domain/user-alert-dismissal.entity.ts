/**
 * Persistent record of a per-day dismiss. `expiresAt` is when the dismiss
 * stops applying — usually midnight in the user's TZ at the time the
 * dismiss happened, but null is allowed for the future-proof case of a
 * persistent-policy dismiss (we currently reject those at the use-case
 * layer, so null shouldn't appear in practice).
 *
 * `GetAlertsForUserUseCase` filters out alerts whose ID matches an active
 * (non-expired) dismissal row for the user. Once `expiresAt < now`, the
 * row is "stale" — we leave it on disk (cheap, no cron needed) and the
 * filter just skips it.
 */
export class UserAlertDismissal {
  constructor(
    readonly id: string,
    readonly userId: string,
    /** Matches `Alert.id`. */
    readonly alertId: string,
    public dismissedAt: Date,
    public expiresAt: Date | null,
  ) {}

  /** True when the dismiss still applies (i.e. should hide the alert). */
  isActiveAt(now: Date): boolean {
    if (this.expiresAt === null) return true;
    return this.expiresAt > now;
  }
}
