/**
 * The 5 alert triggers shipped in v1. Each maps to a stable string ID prefix
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
  /** Active budget whose `amount - spent` is negative. */
  BUDGET_OVERSPENT = 'budget-overspent',
  /** Chore whose `nextDueDate` is earlier than the user's current calendar day. */
  CHORE_OVERDUE = 'chore-overdue',
}
