import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Creates the `currency_pools` table for the internal pool-balance
 * tracking introduced in Phase A1 of the v0.3.x → v1.0.0
 * `accounts-to-modular-finance` refactor.
 *
 * `(userId, currency)` is unique — one pool per pair. The constraint is
 * enforced at the DB level so any race that escapes the application's
 * `pessimistic_write` lock fails loudly with a constraint violation
 * instead of silently inserting a duplicate row.
 *
 * `currency` is `varchar(3) + CHECK` rather than a Postgres ENUM —
 * same pattern as `monthly_services.currency`, keeps migrations cheap
 * if new currencies are added later.
 *
 * `balance NUMERIC(14, 2)` matches `accounts.balance` precision (12
 * integer digits is plenty for any realistic single-user balance).
 *
 * Index on `userId` so the future audit script (A1-B.2) can scan one
 * user's pools cheaply during the `BackfillCurrencyPools` migration's
 * drift check.
 *
 * NOTE: this migration ONLY creates the empty table. The backfill that
 * seeds rows from `SUM(accounts.balance) GROUP BY currency` lives in a
 * separate migration shipped in Phase A1-B.2 (after the audit script is
 * in place to gate it).
 */
export class CreateCurrencyPoolsTable1741000025000 implements MigrationInterface {
  name = 'CreateCurrencyPoolsTable1741000025000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "currency_pools" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "currency" varchar(3) NOT NULL,
        "balance" numeric(14, 2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "deletedAt" timestamptz NULL,
        CONSTRAINT "UQ_currency_pools_user_currency"
          UNIQUE ("userId", "currency"),
        CONSTRAINT "CK_currency_pools_currency"
          CHECK ("currency" IN ('PEN', 'USD', 'EUR'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_currency_pools_userId" ON "currency_pools" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_currency_pools_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "currency_pools"`);
  }
}
