import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase A6-W.4 of the v1.0.0 `accounts-to-modular-finance` refactor.
 *
 * Drops the NOT NULL constraint on `monthly_services."defaultAccountId"`.
 *
 * Why: in v1.0.0 monthly-service payments debit the user's currency pool,
 * not a specific account. The legacy `defaultAccountId` field was only
 * consumed by `POST /monthly-services/:id/pay` (the legacy endpoint, dropped
 * in A6-W.2 from the web and going away in A6-B from the backend). The
 * currency is now an EXPLICIT field on the entity / DTOs (we drop the
 * "currency must match account currency" derivation in the same PR).
 *
 * Behaviour:
 *   - Existing rows keep their `defaultAccountId` value untouched. The
 *     web stops reading and writing the column starting with A6-W.4 of
 *     the web side.
 *   - The column will be DROPPED entirely in A7-B together with the rest
 *     of the legacy plumbing.
 *
 * Reversible — `down()` re-adds NOT NULL, which requires backfilling rows
 * created with NULL in the meantime. Not safe to revert once any row has
 * been created without an account.
 */
export class MakeMonthlyServiceDefaultAccountIdNullable1741000034000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "monthly_services" ALTER COLUMN "defaultAccountId" DROP NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "monthly_services" ALTER COLUMN "defaultAccountId" SET NOT NULL;`,
    );
  }
}
