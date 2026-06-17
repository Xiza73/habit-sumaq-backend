import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase 1 of the `debts-loans/payment-history` feature. Creates the
 * `debt_loan_payments` table — an append-only audit trail of every
 * settlement applied to a `debt_loans` row. Until now the parent table
 * only kept the aggregated `remainingAmount`, with no per-event history
 * for the UI to render.
 *
 * Schema decisions:
 *
 *  - `debtLoanId` is a real FK with `ON DELETE CASCADE`. Unlike the
 *    decoupled-FK convention used elsewhere in this module
 *    (`debt_loans.categoryId` keeps no FK), the relationship here is a
 *    pure parent-child within the SAME module — the child row has no
 *    meaning without its parent, and the cascade matches the lifecycle.
 *
 *  - `currency` is `varchar(3) + CHECK` and NULLABLE. Same convention
 *    as the parent's `currency` column for non-null values; null is
 *    allowed because informal-close settlements don't carry a currency
 *    (they're just a status flip, no money moves through the pool).
 *
 *  - `amount` is `NUMERIC(14, 2)` and CHECK > 0 — same precision as the
 *    parent.
 *
 *  - `note` is `varchar(255)` NULLABLE, reserved for Phase 2 (edit/delete
 *    with user-supplied note). Phase 1 always writes NULL.
 *
 *  - Index on `debtLoanId` to speed up the list endpoint
 *    (`GET /debts/:id/payments`), the only query pattern in Phase 1.
 *
 *  - No `updatedAt` / `deletedAt`: Phase-1 rows are append-only and
 *    immutable. Mutation columns arrive in Phase 2 when edit/delete land.
 *
 *  - No backfill: pre-existing settles on `debt_loans` don't get
 *    historical payment rows. The history starts the moment this
 *    migration runs.
 *
 *  - Column naming: camelCase with double quotes (`"debtLoanId"`,
 *    `"createdAt"`) — same convention as `debts_loans` and every other
 *    v1.0.0 module. Table name stays snake_case (`debt_loan_payments`)
 *    to match the rest of the schema.
 */
export class AddDebtLoanPaymentsTable1741000036000 implements MigrationInterface {
  name = 'AddDebtLoanPaymentsTable1741000036000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "debt_loan_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "debtLoanId" uuid NOT NULL,
        "amount" numeric(14, 2) NOT NULL,
        "currency" varchar(3) NULL,
        "note" varchar(255) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_debt_loan_payments_debt_loan"
          FOREIGN KEY ("debtLoanId") REFERENCES "debts_loans"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_debt_loan_payments_currency"
          CHECK ("currency" IS NULL OR "currency" IN ('PEN', 'USD', 'EUR')),
        CONSTRAINT "CK_debt_loan_payments_amount_positive"
          CHECK ("amount" > 0)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_debt_loan_payments_debtLoanId"
       ON "debt_loan_payments" ("debtLoanId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_debt_loan_payments_debtLoanId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "debt_loan_payments"`);
  }
}
