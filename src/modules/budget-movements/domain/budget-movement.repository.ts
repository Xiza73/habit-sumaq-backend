import { type EntityManager } from 'typeorm';

import { type BudgetMovement } from './budget-movement.entity';

/**
 * Abstract repository for the v1.0.0 `budget_movements` module.
 *
 * Mutating methods accept an optional `EntityManager` so the use case
 * can wrap the row save AND the currency-pool delta in a single
 * `dataSource.transaction()` — matching the pattern established for
 * settle/bulk-settle in `debts_loans`.
 */
export abstract class BudgetMovementRepository {
  /**
   * Lists movements for a budget in date-desc order. Excludes
   * soft-deleted rows.
   */
  abstract findByBudgetId(budgetId: string): Promise<BudgetMovement[]>;

  abstract findById(id: string): Promise<BudgetMovement | null>;

  /**
   * Sum of `amount` for non-deleted movements of a budget. Used by the
   * reports + budgets-dashboard endpoints to compute the budget's
   * `spent` and `remaining` fields without hydrating every row.
   */
  abstract sumByBudgetId(budgetId: string): Promise<number>;

  /**
   * Sum of `amount` per currency for movements in `[from, to)`. Used by
   * the finances-dashboard `periodFlow` widget. Filters out
   * soft-deleted rows. Range is half-open: `from` inclusive, `to`
   * exclusive (same convention as the legacy
   * `txRepo.sumFlowByCurrencyInRange`).
   */
  abstract sumByCurrencyInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ currency: string; total: number }>>;

  /**
   * Top N expense categories by `SUM(amount)` over `[from, to)`,
   * grouped by `(categoryId, currency)`. Rows with `categoryId IS NULL`
   * are surfaced with `name = null` so the UI can render an
   * "Uncategorized" slice — same convention the legacy
   * `txRepo.topExpenseCategoriesInRange` followed.
   *
   * JOINs `categories` for name + color so a single roundtrip
   * delivers the rendered shape.
   */
  abstract topCategoriesByCurrencyInRange(
    userId: string,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<
    Array<{
      categoryId: string | null;
      name: string | null;
      color: string | null;
      currency: string;
      total: number;
    }>
  >;

  abstract save(movement: BudgetMovement, manager?: EntityManager): Promise<BudgetMovement>;

  abstract softDelete(id: string, manager?: EntityManager): Promise<void>;
}
