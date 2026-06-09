import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase A4-B.3 of the `accounts-to-modular-finance` v1.0.0 refactor.
 * Creates the native `monthly_service_payments` table that will
 * replace the `transactions WHERE monthlyServiceId IS NOT NULL`
 * subset.
 *
 * Schema decisions:
 *
 *  - `currency` stored as `varchar(3) + CHECK` — same convention as
 *    `currency_pools`, `debts_loans`, `budget_movements`.
 *
 *  - `period` stored as `varchar(7) + CHECK regex` for `YYYY-MM`.
 *    Keeping it as text (not a generated date) makes the application
 *    code simpler — every layer reads/writes the literal `YYYY-MM`
 *    string and never has to worry about timezone-anchored conversions.
 *
 *  - `(monthlyServiceId, period)` is unique among NON-deleted rows.
 *    Using a partial index `WHERE deletedAt IS NULL` rather than a
 *    table-level UNIQUE constraint lets the user soft-delete a payment
 *    and then re-pay the same period without a constraint clash.
 *
 *  - `monthlyServiceId` is a plain `uuid` with NO FK to
 *    `monthly_services` — mirrors the decoupling pattern from
 *    `debts_loans` and `budget_movements`. The application enforces
 *    ownership.
 *
 *  - `amount` is `NUMERIC(14, 2)` and CHECK > 0. A "payment" of zero
 *    or negative magnitude is meaningless.
 *
 *  - Two indexes: `(userId, date)` for chronological scans (reports,
 *    history view) and `(monthlyServiceId)` standalone for per-service
 *    fetches.
 *
 * Migration ONLY creates the empty table. Backfill from legacy
 * `transactions` happens in `MigrateMonthlyServicePaymentTransactions`.
 */
export class CreateMonthlyServicePaymentsTable1741000032000 implements MigrationInterface {
  name = 'CreateMonthlyServicePaymentsTable1741000032000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "monthly_service_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "monthlyServiceId" uuid NOT NULL,
        "currency" varchar(3) NOT NULL,
        "amount" numeric(14, 2) NOT NULL,
        "period" varchar(7) NOT NULL,
        "description" varchar(255) NULL,
        "date" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "deletedAt" timestamptz NULL,
        CONSTRAINT "CK_msp_currency"
          CHECK ("currency" IN ('PEN', 'USD', 'EUR')),
        CONSTRAINT "CK_msp_amount_positive"
          CHECK ("amount" > 0),
        CONSTRAINT "CK_msp_period_format"
          CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_msp_service_period_active"
       ON "monthly_service_payments" ("monthlyServiceId", "period")
       WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_msp_user_date"
       ON "monthly_service_payments" ("userId", "date")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_msp_service"
       ON "monthly_service_payments" ("monthlyServiceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_msp_service"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_msp_user_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_msp_service_period_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "monthly_service_payments"`);
  }
}
