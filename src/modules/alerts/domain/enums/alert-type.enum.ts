/**
 * The alert triggers. Each maps to a stable string ID prefix
 * (see `alert-id.ts`) and to a dismiss semantic (see `alert-dismiss-policy.ts`).
 *
 * Adding new types is additive — existing dismiss rows + lastAlertsSeenAt
 * timestamps keep working because they don't depend on the enum being
 * closed. Removing or renaming a type IS a breaking change because the
 * persisted dismiss rows reference the old IDs.
 */
export enum AlertType {
  /** Service due in the user's current calendar month and not yet paid. */
  SERVICE_DUE_TODAY = 'service-due-today',
  /** Service whose `nextDuePeriod` is earlier than the user's current month. */
  SERVICE_OVERDUE = 'service-overdue',
  /** DAILY habit with no log for today after midday in the user's TZ. */
  HABITS_MIDDAY = 'habits-midday',
  /**
   * Active budget with money left (`amount - spent > 0`) that has gone 2+
   * consecutive days with no movements ending today — a "did you forget to
   * log an expense?" nudge, since daily basics are logged every day. Gated to
   * the user's local hour >= 12: before that the day has barely started and
   * the nudge asks about spending that had no chance to happen.
   */
  BUDGET_UNLOGGED = 'budget-unlogged',
  /** Chore whose `nextDueDate` is earlier than the user's current calendar day. */
  CHORE_OVERDUE = 'chore-overdue',
  /**
   * Chore whose `nextDueDate` IS the user's current calendar day — "this one
   * is on for today". Mutually exclusive with CHORE_OVERDUE, which is the
   * strictly-earlier case.
   */
  CHORE_DUE_TODAY = 'chore-due-today',
  /**
   * Reminder that is dated, still pending, and whose moment has arrived —
   * its date is today (past its hour, if it has one) or already behind.
   *
   * A reminder with no date never fires: it is a note the user has not
   * scheduled yet, and nagging about it would punish writing things down.
   */
  REMINDER_DUE = 'reminder-due',
}
