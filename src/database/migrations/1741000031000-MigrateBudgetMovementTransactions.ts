import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase A4-B.1 of the `accounts-to-modular-finance` refactor. Copies
 * every legacy `transactions` row where `budgetId IS NOT NULL` into the
 * new native `budget_movements` table.
 *
 * Filter rationale:
 *   - `type = 'EXPENSE'`: budget movements are always expenses by
 *     design. Defensive — should be redundant since the legacy UI never
 *     let you tag INCOME with a budgetId, but better safe.
 *   - `budgetId IS NOT NULL`: the actual selector.
 *   - `amount > 0`: skip any zero/negative legacy garbage (the new
 *     schema's `CK_budget_movements_amount_positive` would reject them
 *     anyway). Same defense as in the debts-loans migration.
 *
 * Currency is JOINed in from `accounts` (the legacy transaction
 * inherited the currency from its source account). Soft-deleted legacy
 * rows ARE migrated; their `deletedAt` is preserved so the new module's
 * timeline view can still surface them as historical context.
 *
 * Legacy `transactions` rows are NOT deleted by this migration. They
 * coexist until Phase A6 retires the legacy module and A7 drops the
 * table.
 *
 * Idempotent via `ON CONFLICT (id) DO NOTHING`. The `id` is preserved
 * so any external reference to the legacy row keeps working.
 */
export class MigrateBudgetMovementTransactions1741000031000 implements MigrationInterface {
  name = 'MigrateBudgetMovementTransactions1741000031000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "budget_movements" (
        "id",
        "userId",
        "budgetId",
        "categoryId",
        "currency",
        "amount",
        "description",
        "date",
        "createdAt",
        "updatedAt",
        "deletedAt"
      )
      SELECT
        t."id",
        t."userId",
        t."budgetId",
        t."categoryId",
        a."currency",
        t."amount",
        t."description",
        t."date",
        t."createdAt",
        t."updatedAt",
        t."deletedAt"
      FROM "transactions" t
      INNER JOIN "accounts" a ON a.id = t."accountId"
      WHERE t."budgetId" IS NOT NULL
        AND t."type" = 'EXPENSE'
        AND t."amount" > 0
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Mirror of the debts-loans migration's down() — delete only rows
    // that came from this migration. A row is "from this migration" if
    // it still exists with a matching id and `budgetId IS NOT NULL` in
    // the legacy `transactions` table.
    await queryRunner.query(`
      DELETE FROM "budget_movements" bm
      WHERE EXISTS (
        SELECT 1
        FROM "transactions" t
        WHERE t."id" = bm."id"
          AND t."budgetId" IS NOT NULL
      )
    `);
  }
}
