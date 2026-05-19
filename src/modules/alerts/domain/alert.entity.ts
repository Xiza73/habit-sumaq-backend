import type { AlertSeverity } from './enums/alert-severity.enum';
import type { AlertType } from './enums/alert-type.enum';

/**
 * In-memory entity. Alerts are NOT a persisted resource — `GetAlertsForUserUseCase`
 * builds them on the fly from the data in services / habits / budgets / chores.
 * The only thing we persist is dismissals (`user_alert_dismissals`) plus a
 * single `lastAlertsSeenAt` timestamp on `user_settings` (for badge counts).
 *
 * The `id` is the stable string from `alert-id.ts`. The `payload` blob carries
 * the small bag of fields the frontend needs to render the CTA (e.g. the
 * serviceId so `Pagar ahora` can deep-link). Keeping it free-form here so
 * we don't have to bump the entity every time we expose a new field — it
 * gets typed at the DTO layer.
 */
export class Alert {
  constructor(
    /** Stable string — see `alert-id.ts` for format. */
    readonly id: string,
    readonly type: AlertType,
    readonly severity: AlertSeverity,
    /**
     * UTC timestamp the alert "first appeared". The badge counts an alert
     * as unread when `triggeredAt > user.lastAlertsSeenAt`. For per-day
     * alerts this is the start of the user's current day; for persistent
     * ones it's whatever earlier date the condition transitioned into
     * existence.
     */
    readonly triggeredAt: Date,
    /**
     * Free-form payload to drive the UI. Keep small (entity-id pointers,
     * a localized title key, the deep-link href, no domain entities) so
     * cache + serialization stay cheap.
     */
    readonly payload: Record<string, string | number | null>,
  ) {}
}
