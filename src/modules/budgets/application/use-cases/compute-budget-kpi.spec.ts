import { makeBudget } from '../../domain/__tests__/budget.factory';

import { computeBudgetKpi } from './compute-budget-kpi';

describe('computeBudgetKpi', () => {
  const TZ = 'America/Lima';
  // Lima is UTC-5 — 17:00 UTC on the 15th is 12:00 local on the 15th.
  const NOW_APRIL_15_LIMA = new Date('2026-04-15T17:00:00.000Z');

  it('counts today + remaining days when the budget is the active month', () => {
    const budget = makeBudget({ year: 2026, month: 4, amount: 1500 });
    const kpi = computeBudgetKpi(budget, 600, TZ, NOW_APRIL_15_LIMA);

    // April has 30 days. From the 15th onward = 16 days (15..30 inclusive).
    expect(kpi.daysRemainingIncludingToday).toBe(16);
    expect(kpi.spent).toBe(600);
    expect(kpi.remaining).toBe(900);
    expect(kpi.dailyAllowance).toBe(56.25); // 900 / 16
    expect(kpi.currentDate).toBe('2026-04-15');
  });

  it('returns 0 days and null daily allowance for a budget in a past month', () => {
    const budget = makeBudget({ year: 2026, month: 3, amount: 1000 });
    const kpi = computeBudgetKpi(budget, 800, TZ, NOW_APRIL_15_LIMA);

    expect(kpi.daysRemainingIncludingToday).toBe(0);
    expect(kpi.dailyAllowance).toBeNull();
    expect(kpi.remaining).toBe(200);
  });

  it('returns full month length for a budget in a future month', () => {
    // May 2026 has 31 days.
    const budget = makeBudget({ year: 2026, month: 5, amount: 2000 });
    const kpi = computeBudgetKpi(budget, 0, TZ, NOW_APRIL_15_LIMA);

    expect(kpi.daysRemainingIncludingToday).toBe(31);
    expect(kpi.dailyAllowance).toBe(64.52); // 2000 / 31, rounded
  });

  it('handles overspend with a negative daily allowance', () => {
    const budget = makeBudget({ year: 2026, month: 4, amount: 500 });
    const kpi = computeBudgetKpi(budget, 800, TZ, NOW_APRIL_15_LIMA);

    expect(kpi.remaining).toBe(-300);
    // 16 days remain in April from the 15th. -300 / 16 = -18.75
    expect(kpi.dailyAllowance).toBe(-18.75);
  });

  it('handles February of a leap year', () => {
    const budget = makeBudget({ year: 2028, month: 2, amount: 290 });
    // Active period — Feb 1, 2028.
    const feb1 = new Date('2028-02-01T17:00:00.000Z');
    const kpi = computeBudgetKpi(budget, 0, TZ, feb1);

    expect(kpi.daysRemainingIncludingToday).toBe(29); // 2028 is a leap year
    expect(kpi.dailyAllowance).toBe(10);
  });

  it('respects the user timezone when comparing past vs current vs future', () => {
    // The user is in Auckland (UTC+12). At 22:00 UTC on April 30, locally
    // it's already May 1 — a budget for April should look "past".
    const budget = makeBudget({ year: 2026, month: 4 });
    const lateApril30Utc = new Date('2026-04-30T22:00:00.000Z');
    const kpi = computeBudgetKpi(budget, 0, 'Pacific/Auckland', lateApril30Utc);
    expect(kpi.daysRemainingIncludingToday).toBe(0);
  });
});
