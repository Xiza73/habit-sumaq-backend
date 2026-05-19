import { AlertType } from './enums/alert-type.enum';

/**
 * Whether an alert type accepts a `Cerrar` dismiss from the UI.
 *
 * - `per-day`: dismiss hides the alert until midnight in the user's TZ.
 *   If the underlying condition still applies tomorrow, the alert reappears
 *   (its ID embeds the period or date, so a fresh row gets a fresh state).
 * - `persistent`: no Cerrar button. The alert is shown until the underlying
 *   condition stops being true (the user pays the service, marks the chore
 *   done, brings the budget back into the black). `DismissAlertUseCase`
 *   rejects calls for these types with `ALR_001` — defense-in-depth so a
 *   misbehaving client can't insert a dead-row in `user_alert_dismissals`.
 *
 * Mapping locked in with the user before code (see business-rules / the
 * design conversation that landed item #3).
 */
export type DismissPolicy = 'per-day' | 'persistent';

const DISMISS_POLICY: Record<AlertType, DismissPolicy> = {
  [AlertType.SERVICE_DUE_TODAY]: 'per-day',
  [AlertType.SERVICE_OVERDUE]: 'persistent',
  [AlertType.HABITS_MIDDAY]: 'per-day',
  [AlertType.BUDGET_OVERSPENT]: 'persistent',
  [AlertType.CHORE_OVERDUE]: 'persistent',
};

export function dismissPolicyFor(type: AlertType): DismissPolicy {
  return DISMISS_POLICY[type];
}

export function isDismissable(type: AlertType): boolean {
  return dismissPolicyFor(type) === 'per-day';
}
