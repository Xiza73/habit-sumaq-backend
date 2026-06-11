import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase A3-B of the `accounts-to-modular-finance` refactor. Creates the
 * native `debts_loans` table that will replace the DEBT/LOAN subset of
 * the `transactions` table.
 *
 * Schema decisions:
 *
 *  - `type` and `status` stored as `varchar + CHECK` rather than
 *    postgres ENUM types — same convention as `monthly_services.currency`
 *    and `chores.intervalUnit`. Keeps migrations cheap if values are
 *    ever added.
 *
 *  - `currency` stored as `varchar(3) + CHECK` — same pattern as
 *    `currency_pools.currency`.
 *
 *  - `categoryId` is a plain `uuid` column with NO FK to `categories`.
 *    This mirrors how `transactions.categoryId` is handled today — the
 *    application enforces ownership; the DB stays decoupled so a future
 *    `categories` migration can move/rename without breaking this table.
 *
 *  - `reference` is `varchar(255) NOT NULL` — DEBT/LOAN always have a
 *    reference (who you owe / who owes you). Indexed via a separate
 *    `LOWER(unaccent(reference))` functional index so the summary query
 *    and the bulk-settle-by-reference flow can match case + accent
 *    insensitively without a full table scan.
 *
 *  - Amounts as `NUMERIC(14, 2)` — same precision as
 *    `transactions.amount` and `accounts.balance`.
 *
 *  - Index on `(userId, status)` for the per-user-pending listing,
 *    which is the most common query pattern (the dashboard's main view).
 *
 *  - This migration ONLY creates the empty table. Backfill from
 *    `transactions` happens in the next migration (A3-B's second
 *    migration: `MigrateDebtLoanTransactions`).
 */
export class CreateDebtsLoansTable1741000028000 implements MigrationInterface {
  name = 'CreateDebtsLoansTable1741000028000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "debts_loans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "type" varchar(4) NOT NULL,
        "categoryId" uuid NULL,
        "currency" varchar(3) NOT NULL,
        "amount" numeric(14, 2) NOT NULL,
        "remainingAmount" numeric(14, 2) NOT NULL,
        "status" varchar(8) NOT NULL,
        "reference" varchar(255) NOT NULL,
        "description" varchar(255) NULL,
        "date" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "deletedAt" timestamptz NULL,
        CONSTRAINT "CK_debts_loans_type"     CHECK ("type"   IN ('DEBT', 'LOAN')),
        CONSTRAINT "CK_debts_loans_status"   CHECK ("status" IN ('PENDING', 'SETTLED')),
        CONSTRAINT "CK_debts_loans_currency" CHECK ("currency" IN ('PEN', 'USD', 'EUR')),
        CONSTRAINT "CK_debts_loans_amount_positive"
          CHECK ("amount" > 0),
        CONSTRAINT "CK_debts_loans_remaining_nonneg"
          CHECK ("remainingAmount" >= 0),
        CONSTRAINT "CK_debts_loans_remaining_within_amount"
          CHECK ("remainingAmount" <= "amount")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_debts_loans_user_status" ON "debts_loans" ("userId", "status")`,
    );

    // Postgres' `unaccent` function lives in the `unaccent` extension.
    // It's used by `aggregateByReference` and `findPendingByNormalizedReference`
    // in their `LOWER(unaccent(reference))` lookups (case + accent insensitive).
    // No functional index here: `unaccent` is `STABLE`, not `IMMUTABLE`, so
    // Postgres rejects it inside `CREATE INDEX`. Wrapping it in an
    // `IMMUTABLE` SQL function would work, but at single-user-prod scale the
    // queries are fast as sequential scans within the per-user dataset
    // (already filtered by the `(userId, status)` index). When N grows we
    // can revisit with either pg_trgm or an `immutable_unaccent` wrapper.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_debts_loans_user_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "debts_loans"`);
    // Intentionally NOT dropping the `unaccent` extension — other queries
    // (the legacy transactions debts-summary) still need it.
  }
}
