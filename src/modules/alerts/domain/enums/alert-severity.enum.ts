/**
 * Coarse severity bucket. Frontend uses this to pick color + icon tone in
 * the bell popover. Kept intentionally small (2 levels) — pseudo-notifications
 * don't deserve a 5-level taxonomy.
 *
 * - `info`: the user can act on it but it's not "wrong" (due today, missing
 *   habit check-in mid-day). Neutral / primary tint.
 * - `warning`: the user is behind on something (overdue, overspent). Destructive
 *   or amber tint.
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
}
