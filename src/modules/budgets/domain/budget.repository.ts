import type { Budget } from './budget.entity';

export abstract class BudgetRepository {
  /** All non-soft-deleted budgets for this user, newest period first. */
  abstract findByUserId(userId: string): Promise<Budget[]>;

  abstract findById(id: string): Promise<Budget | null>;

  /**
   * Locates the budget for a given (user, year, month, currency) tuple. Returns
   * null when no budget exists — used by `GET /budgets/current` to decide
   * whether to render "create budget" CTA or the dashboard.
   */
  abstract findByPeriodAndCurrency(
    userId: string,
    year: number,
    month: number,
    currency: string,
  ): Promise<Budget | null>;

  abstract save(budget: Budget): Promise<Budget>;

  /** Soft-delete by id (sets deletedAt=now). Caller is responsible for first nullifying linked transactions' budgetId. */
  abstract softDelete(id: string): Promise<void>;
}
