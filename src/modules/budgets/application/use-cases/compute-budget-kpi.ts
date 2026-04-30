import {
  currentDateInTimezone,
  daysInMonth,
} from '../../infrastructure/timezone/current-month-in-timezone';

import type { Budget } from '../../domain/budget.entity';

export interface BudgetKpiSnapshot {
  spent: number;
  remaining: number;
  daysRemainingIncludingToday: number;
  dailyAllowance: number | null;
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

  const currentDate = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;

  return {
    spent: round2(spent),
    remaining,
    daysRemainingIncludingToday: daysRemaining,
    dailyAllowance,
    currentDate,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
