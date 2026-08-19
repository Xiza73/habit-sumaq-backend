import {
  currentDateInTimezone,
  daysInMonth,
} from '../../infrastructure/timezone/current-month-in-timezone';

import type { Budget } from '../../domain/budget.entity';

/**
 * How long the user has to hold back to get the daily allowance back up to
 * what it was on day 1 of the month.
 */
export interface BudgetRecoveryPlan {
  /** Whole days spending nothing. */
  zeroSpendDays: number;
  /** Whole days spending half the initial allowance — always 2x the above. */
  halfSpendDays: number;
  /**
   * False when even spending nothing for the rest of the month cannot get
   * there. Render that as "no recuperable este mes" rather than a day count
   * the user cannot act on.
   */
  recoverable: boolean;
}

export interface BudgetKpiSnapshot {
  spent: number;
  remaining: number;
  daysRemainingIncludingToday: number;
  dailyAllowance: number | null;
  /**
   * `amount / daysInMonth` — the allowance the month started with, and the
   * bar the recovery plan aims at. Null for a closed month.
   */
  initialDailyAllowance: number | null;
  /** Null for a closed month: there is nothing left to recover into. */
  recovery: BudgetRecoveryPlan | null;
  /** `YYYY-MM-DD` reflecting the user's current local date. */
  currentDate: string;
}

/**
 * Computes the snapshot fields rendered on the budget dashboard.
 *
 * Rules:
 *  - `spent` is provided by the caller (from `transactions.sumAmountByBudgetId`).
 *  - `daysRemainingIncludingToday` counts today + the rest of the budget's month.
 *    For a budget in a past month: 0. For a future month: full month length.
 *  - `dailyAllowance` is `remaining / daysRemainingIncludingToday`, rounded to
 *    2 decimals. Negative when the user has overspent. Null when no days
 *    remain (past budget) — frontend renders that case as "mes cerrado".
 */
export function computeBudgetKpi(
  budget: Budget,
  spent: number,
  timezone: string,
  now: Date = new Date(),
): BudgetKpiSnapshot {
  const today = currentDateInTimezone(timezone, now);
  const remaining = round2(budget.amount - spent);

  let daysRemaining: number;
  if (today.year < budget.year || (today.year === budget.year && today.month < budget.month)) {
    // Future budget — full month ahead.
    daysRemaining = daysInMonth(budget.year, budget.month);
  } else if (
    today.year > budget.year ||
    (today.year === budget.year && today.month > budget.month)
  ) {
    // Past budget — month already closed.
    daysRemaining = 0;
  } else {
    // Active month — today is included in the count.
    const dim = daysInMonth(budget.year, budget.month);
    daysRemaining = dim - today.day + 1;
  }

  const dailyAllowance = daysRemaining > 0 ? round2(remaining / daysRemaining) : null;

  const dim = daysInMonth(budget.year, budget.month);
  const initialDailyAllowance = daysRemaining > 0 ? round2(budget.amount / dim) : null;
  const recovery = computeRecovery(budget.amount, dim, remaining, daysRemaining);

  const currentDate = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;

  return {
    spent: round2(spent),
    remaining,
    daysRemainingIncludingToday: daysRemaining,
    dailyAllowance,
    initialDailyAllowance,
    recovery,
    currentDate,
  };
}

/**
 * Days of restraint needed to bring `remaining / daysLeft` back up to the
 * month's opening allowance `a0 = amount / daysInMonth`.
 *
 * Spending nothing for k days leaves the same `remaining` over `daysLeft - k`
 * days, so the allowance climbs to `remaining / (daysLeft - k)`. Setting that
 * at or above `a0` and solving:
 *
 *   remaining / (daysLeft - k) >= amount / daysInMonth
 *   k >= daysLeft - remaining * daysInMonth / amount
 *
 * Spending a fraction `f` of `a0` instead of nothing stretches the same answer
 * to `k / (1 - f)` — so half-spend is exactly double, which is why
 * `halfSpendDays` is derived rather than solved again.
 *
 * Rounded UP: a partial day of restraint does not get you there.
 */
function computeRecovery(
  amount: number,
  daysInMonth_: number,
  remaining: number,
  daysLeft: number,
): BudgetRecoveryPlan | null {
  // Closed month — no days left to recover into.
  if (daysLeft <= 0) return null;

  const zeroSpendDays = Math.max(0, Math.ceil(daysLeft - (remaining * daysInMonth_) / amount));
  // Needing the whole remainder of the month means there is no day left to
  // actually spend the recovered allowance on, so it does not count as
  // recovered. Overspent budgets land here too, with `remaining` negative
  // pushing the count past `daysLeft`.
  const recoverable = zeroSpendDays < daysLeft;

  return { zeroSpendDays, halfSpendDays: zeroSpendDays * 2, recoverable };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
