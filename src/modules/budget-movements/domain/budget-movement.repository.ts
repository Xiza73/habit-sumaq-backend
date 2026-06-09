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

  abstract save(movement: BudgetMovement, manager?: EntityManager): Promise<BudgetMovement>;

  abstract softDelete(id: string, manager?: EntityManager): Promise<void>;
}
