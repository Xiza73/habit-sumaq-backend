import { AlertType } from './enums/alert-type.enum';

/**
 * Pure helpers for building + parsing alert IDs. The IDs are stable strings
 * the user persists in `user_alert_dismissals.alertId`. Their shape MUST stay
 * consistent across releases — changing the format orphans every existing
 * dismiss row.
 *
 * Format conventions:
 *  - All segments separated by `:`. Easy to grep, easy to print in logs.
 *  - The `type` prefix exactly matches the `AlertType` string value, so a
 *    plain `id.startsWith(type)` test classifies the row without parsing.
 *  - Per-day types embed the scope window (period or date) so dismissing
 *    today doesn't carry over to tomorrow. Persistent types DON'T —
 *    same ID across days because "I want to be reminded until I fix it"
 *    is the contract.
 *
 * The format is repeated below — read the type signatures, don't trust the
 * docs alone if they drift.
 */

/** `service:due:{serviceId}:{YYYY-MM}` — per-day, scoped to the period. */
export function serviceDueTodayId(serviceId: string, period: string): string {
  return `${AlertType.SERVICE_DUE_TODAY}:${serviceId}:${period}`;
}

/** `service:overdue:{serviceId}` — persistent across days. */
export function serviceOverdueId(serviceId: string): string {
  return `${AlertType.SERVICE_OVERDUE}:${serviceId}`;
}

/** `habits-midday:{YYYY-MM-DD}` — per-day, single per-user alert (not per habit). */
export function habitsMiddayId(date: string): string {
  return `${AlertType.HABITS_MIDDAY}:${date}`;
}

/** `budget-overspent:{budgetId}` — persistent until the user tops up the budget. */
export function budgetOverspentId(budgetId: string): string {
  return `${AlertType.BUDGET_OVERSPENT}:${budgetId}`;
}

/** `chore-overdue:{choreId}` — persistent until the user marks the chore done. */
export function choreOverdueId(choreId: string): string {
  return `${AlertType.CHORE_OVERDUE}:${choreId}`;
}

/**
 * Recover the `AlertType` from a persisted ID. Used by `DismissAlertUseCase`
 * to look up the dismiss policy without coupling the caller to the format.
 * Returns `null` for an ID whose prefix doesn't match any known type —
 * defensive against forward-compat (a future alert type could land in the DB
 * via a newer client + roll back to an older server).
 */
export function typeFromAlertId(alertId: string): AlertType | null {
  for (const type of Object.values(AlertType)) {
    // Prefix match with `:` boundary so `service-due-today` doesn't accidentally
    // also match an ID starting with `service-due-today-extra` should we ever
    // add such a sibling type.
    const prefix = type as string;
    if (alertId === prefix || alertId.startsWith(`${prefix}:`)) {
      return type;
    }
  }
  return null;
}
