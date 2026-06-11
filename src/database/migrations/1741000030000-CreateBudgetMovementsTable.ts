import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase A4-B.1 of the `accounts-to-modular-finance` v1.0.0 refactor.
 * Creates the native `budget_movements` table that will replace the
 * `transactions WHERE budgetId IS NOT NULL` subset.
 *
 * Schema decisions:
 *
 *  - `currency` stored as `varchar(3) + CHECK` — same as
 *    `currency_pools.currency` and `debts_loans.currency`. No postgres
 *    ENUM type so adding a new currency is a CHECK-list bump, not a
 *    cross-schema migration.
 *
 *  - `categoryId` is a plain `uuid` column with NO FK to `categories`.
 *    Mirrors the convention from `debts_loans` and the legacy
 *    transactions — application enforces ownership; the DB stays
 *    decoupled so a future `categories` migration can move/rename
 *    without breaking this table.
 *
 *  - `budgetId` is a plain `uuid` with NO FK either. Even though the
 *    `budgets` table sticks around in v1.0.0, deletes are SOFT (via
 *    `deletedAt`), and an FK would force ON DELETE CASCADE / RESTRICT
 *    behavior we don't want. The application enforces the link.
 *
 *  - `amount` is `NUMERIC(14, 2)` and CHECK > 0. Negative or zero
 *    "movements" are meaningless — to delete one, soft-delete it.
 *
 *  - Two indexes: `(userId, date)` for chronological scans (reports,
 *    the budgets-dashboard daily KPI), and `(budgetId)` standalone for
 *    the per-budget fetch.
 *
 * Migration ONLY creates the empty table. Backfill from legacy
 * `transactions` happens in the next migration
 * (`MigrateBudgetMovementTransactions`).
 */
export class CreateBudgetMovementsTable1741000030000 implements MigrationInterface {
  name = 'CreateBudgetMovementsTable1741000030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "budget_movements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "budgetId" uuid NOT NULL,
        "categoryId" uuid NULL,
        "currency" varchar(3) NOT NULL,
        "amount" numeric(14, 2) NOT NULL,
        "description" varchar(255) NULL,
        "date" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "deletedAt" timestamptz NULL,
        CONSTRAINT "CK_budget_movements_currency"
          CHECK ("currency" IN ('PEN', 'USD', 'EUR')),
        CONSTRAINT "CK_budget_movements_amount_positive"
          CHECK ("amount" > 0)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_budget_movements_user_date" ON "budget_movements" ("userId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_budget_movements_budget" ON "budget_movements" ("budgetId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_budget_movements_budget"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_budget_movements_user_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "budget_movements"`);
  }
}
