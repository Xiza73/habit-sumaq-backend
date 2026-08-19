import { makeBudget } from '../../domain/__tests__/budget.factory';

import { computeBudgetKpi } from './compute-budget-kpi';

describe('computeBudgetKpi', () => {
  describe('recovery plan', () => {
    // The question the plan answers: the daily allowance drops the moment you
    // overspend, so how long do you have to hold back to earn it back?
    //
    // With A = amount, D = days in month, R = remaining, d = days left
    // including today, and a0 = A/D the allowance you started the month with:
    //
    //   spend 0 for k days  →  allowance becomes R / (d - k)
    //   want that >= a0     →  k >= d - R*D/A
    //
    // and spending a fraction f of a0 instead stretches it to k / (1 - f).
    // Half-spend is therefore exactly DOUBLE the zero-spend answer, which is
    // the relation the fixtures below pin.
    const TZ_ = 'America/Lima';

    it('needs no recovery while the allowance is still at or above the initial one', () => {
      // 3000 over 30 days = 100/day to start. On the 10th having spent 900,
      // the pace is exactly on plan, so there is nothing to recover.
      const budget = makeBudget({ year: 2026, month: 4, amount: 3000 });
      const kpi = computeBudgetKpi(budget, 900, TZ_, new Date('2026-04-10T17:00:00.000Z'));

      expect(kpi.initialDailyAllowance).toBe(100);
      expect(kpi.recovery).toEqual({ zeroSpendDays: 0, halfSpendDays: 0 });
    });

    it('counts the zero-spend days needed to get back to the initial allowance', () => {
      // 3000 over 30 days → a0 = 100. On the 10th, 1500 spent.
      // R = 1500, d = 21, current allowance 71.43 — behind.
      // k = 21 - 1500*30/3000 = 6. After 6 idle days: 1500 / 15 = 100 exactly.
      const budget = makeBudget({ year: 2026, month: 4, amount: 3000 });
      const kpi = computeBudgetKpi(budget, 1500, TZ_, new Date('2026-04-10T17:00:00.000Z'));

      expect(kpi.daysRemainingIncludingToday).toBe(21);
      expect(kpi.initialDailyAllowance).toBe(100);
      expect(kpi.recovery?.zeroSpendDays).toBe(6);
    });

    it('takes exactly twice as long at half the initial allowance', () => {
      // Same fixture: 12 days at 50/day → 1500 - 600 = 900 over 9 days = 100.
      const budget = makeBudget({ year: 2026, month: 4, amount: 3000 });
      const kpi = computeBudgetKpi(budget, 1500, TZ_, new Date('2026-04-10T17:00:00.000Z'));

      // Both fit here (d = 21), so the 2x relation holds and is visible.
      expect(kpi.recovery?.halfSpendDays).toBe(2 * kpi.recovery!.zeroSpendDays!);
      expect(kpi.recovery?.halfSpendDays).toBe(12);
    });

    it('rounds up — a partial day of restraint does not get you there', () => {
      // 3000/30 → a0 = 100. On the 10th, 1600 spent. R = 1400, d = 21.
      // k = 21 - 1400*30/3000 = 21 - 14 = 7 exactly... so nudge it off:
      // 1610 spent → R = 1390 → k = 21 - 13.9 = 7.1 → 8 whole days.
      const budget = makeBudget({ year: 2026, month: 4, amount: 3000 });
      const kpi = computeBudgetKpi(budget, 1610, TZ_, new Date('2026-04-10T17:00:00.000Z'));

      expect(kpi.recovery?.zeroSpendDays).toBe(8);
    });

    it('drops the half-spend plan on its own when it does not fit the month', () => {
      // The bug this replaces: `halfSpendDays` was always 2x zeroSpendDays and
      // was reported even when it exceeded the days actually left — telling
      // someone on the 19th to hold back for 18 days of a month with 12 left.
      //
      // 3000/30 -> a0 = 100. On the 19th: d = 12. Spend 1500 -> R = 1500,
      // k0 = 12 - 15 = -3 -> 0, nothing to recover. Push to 2500:
      // R = 500, k0 = ceil(12 - 5) = 7 (fits), half = 14 (does NOT fit in 12).
      const budget = makeBudget({ year: 2026, month: 4, amount: 3000 });
      const kpi = computeBudgetKpi(budget, 2500, TZ_, new Date('2026-04-19T17:00:00.000Z'));

      expect(kpi.daysRemainingIncludingToday).toBe(12);
      expect(kpi.recovery?.zeroSpendDays).toBe(7);
      expect(kpi.recovery?.halfSpendDays).toBeNull();
    });

    it('reports both plans as null when even total abstinence is not enough', () => {
      // 2990 spent by the 10th. R = 10, d = 21, k = ceil(21 - 0.1) = 21 — the
      // whole rest of the month, so there is no day left to spend on.
      const budget = makeBudget({ year: 2026, month: 4, amount: 3000 });
      const kpi = computeBudgetKpi(budget, 2990, TZ_, new Date('2026-04-10T17:00:00.000Z'));

      expect(kpi.recovery).toEqual({ zeroSpendDays: null, halfSpendDays: null });
    });

    it('reports null rather than a count once the budget is blown', () => {
      const budget = makeBudget({ year: 2026, month: 4, amount: 3000 });
      const kpi = computeBudgetKpi(budget, 3400, TZ_, new Date('2026-04-10T17:00:00.000Z'));

      expect(kpi.remaining).toBe(-400);
      expect(kpi.recovery).toEqual({ zeroSpendDays: null, halfSpendDays: null });
    });

    it('never reports a plan longer than the days the month has left', () => {
      // The invariant behind all of the above, asserted directly across a
      // sweep of spend levels rather than at one hand-picked point.
      const budget = makeBudget({ year: 2026, month: 4, amount: 3000 });

      for (let spent = 0; spent <= 3600; spent += 50) {
        const kpi = computeBudgetKpi(budget, spent, TZ_, new Date('2026-04-19T17:00:00.000Z'));
        const d = kpi.daysRemainingIncludingToday;

        expect(kpi.recovery?.zeroSpendDays ?? 0).toBeLessThan(d);
        expect(kpi.recovery?.halfSpendDays ?? 0).toBeLessThan(d);
      }
    });

    it('has no plan for a closed month — there is nothing left to recover into', () => {
      const budget = makeBudget({ year: 2026, month: 3, amount: 1000 });
      const kpi = computeBudgetKpi(budget, 1200, TZ_, new Date('2026-04-10T17:00:00.000Z'));

      expect(kpi.daysRemainingIncludingToday).toBe(0);
      expect(kpi.recovery).toBeNull();
    });
  });

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
