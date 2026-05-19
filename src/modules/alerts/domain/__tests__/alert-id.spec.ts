import {
  budgetOverspentId,
  choreOverdueId,
  habitsMiddayId,
  serviceDueTodayId,
  serviceOverdueId,
  typeFromAlertId,
} from '../alert-id';
import { AlertType } from '../enums/alert-type.enum';

describe('alert-id helpers', () => {
  describe('builders', () => {
    it('serviceDueTodayId embeds the period so dismissing today does not carry over', () => {
      const may = serviceDueTodayId('abc', '2026-05');
      const jun = serviceDueTodayId('abc', '2026-06');
      expect(may).toBe('service-due-today:abc:2026-05');
      expect(jun).toBe('service-due-today:abc:2026-06');
      expect(may).not.toBe(jun);
    });

    it('serviceOverdueId is stable across days (persistent policy)', () => {
      expect(serviceOverdueId('abc')).toBe('service-overdue:abc');
    });

    it('habitsMiddayId embeds the date — a fresh row per day', () => {
      expect(habitsMiddayId('2026-05-19')).toBe('habits-midday:2026-05-19');
    });

    it('budgetOverspentId is stable per budget', () => {
      expect(budgetOverspentId('xyz')).toBe('budget-overspent:xyz');
    });

    it('choreOverdueId is stable per chore', () => {
      expect(choreOverdueId('def')).toBe('chore-overdue:def');
    });
  });

  describe('typeFromAlertId', () => {
    it('classifies every alert type built by the helpers above', () => {
      expect(typeFromAlertId(serviceDueTodayId('a', '2026-05'))).toBe(AlertType.SERVICE_DUE_TODAY);
      expect(typeFromAlertId(serviceOverdueId('a'))).toBe(AlertType.SERVICE_OVERDUE);
      expect(typeFromAlertId(habitsMiddayId('2026-05-19'))).toBe(AlertType.HABITS_MIDDAY);
      expect(typeFromAlertId(budgetOverspentId('a'))).toBe(AlertType.BUDGET_OVERSPENT);
      expect(typeFromAlertId(choreOverdueId('a'))).toBe(AlertType.CHORE_OVERDUE);
    });

    it('returns null for an unknown prefix (forward-compat with deprecated types)', () => {
      expect(typeFromAlertId('totally-not-a-type:foo')).toBeNull();
      expect(typeFromAlertId('')).toBeNull();
    });

    it('uses the `:` boundary so partial prefix matches do NOT mis-classify', () => {
      // If someone ever ships a `service-due-today-extra:...` ID, it MUST
      // NOT be classified as `service-due-today`. The current `startsWith(`${type}:`)`
      // check prevents that.
      expect(typeFromAlertId('service-due-today-extra:abc')).toBeNull();
    });
  });
});
