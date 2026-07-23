import { dismissPolicyFor, isDismissable } from '../alert-dismiss-policy';
import { AlertType } from '../enums/alert-type.enum';

describe('alert-dismiss-policy', () => {
  // Lock the mapping from the design conversation that landed item #3.
  // If any of these flips, the UX contract changes — the corresponding
  // frontend code that hides/shows the Cerrar button has to be updated
  // in lockstep.
  it('per-day: service-due-today, habits-midday, budget-unlogged', () => {
    expect(dismissPolicyFor(AlertType.SERVICE_DUE_TODAY)).toBe('per-day');
    expect(dismissPolicyFor(AlertType.HABITS_MIDDAY)).toBe('per-day');
    expect(dismissPolicyFor(AlertType.BUDGET_UNLOGGED)).toBe('per-day');
  });

  it('persistent: service-overdue, chore-overdue', () => {
    expect(dismissPolicyFor(AlertType.SERVICE_OVERDUE)).toBe('persistent');
    expect(dismissPolicyFor(AlertType.CHORE_OVERDUE)).toBe('persistent');
  });

  it('isDismissable mirrors `policy === per-day`', () => {
    expect(isDismissable(AlertType.SERVICE_DUE_TODAY)).toBe(true);
    expect(isDismissable(AlertType.SERVICE_OVERDUE)).toBe(false);
    expect(isDismissable(AlertType.BUDGET_UNLOGGED)).toBe(true);
  });

  it('every AlertType has a policy entry (catches incomplete registry)', () => {
    // If someone adds a new AlertType but forgets the mapping, this test
    // surfaces it before the use cases crash at runtime.
    for (const type of Object.values(AlertType)) {
      expect(['per-day', 'persistent']).toContain(dismissPolicyFor(type));
    }
  });
});
