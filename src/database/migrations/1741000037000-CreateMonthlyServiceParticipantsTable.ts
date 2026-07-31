import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Slice 1 of the `shared-service-payments` feature. Creates the
 * `monthly_service_participants` table — the config a shared monthly
 * service uses to split its bill among people (e.g. "Ana: 100, Luis: 80").
 * Payment generation (linking these participants to `debts_loans` rows on
 * pay) lands in a later slice; this migration only adds the config table.
 *
 * Schema decisions:
 *
 *  - `normalizedReference` is a PLAIN column, populated by the APPLICATION
 *    layer (`common/text/normalize-reference.ts`) on insert/update — NOT a
 *    Postgres `GENERATED ALWAYS AS (...) STORED` column. Postgres requires
 *    generated-column expressions to be IMMUTABLE; `unaccent()` is STABLE,
 *    so `CREATE TABLE ... GENERATED ALWAYS AS (LOWER(unaccent(reference)))`
 *    fails outright. This is the same wall documented in migration
 *    `1741000028000` (why `debts_loans` also avoids a functional index on
 *    `unaccent(reference)`). Mirrors how the app already normalizes
 *    references at the boundary (`findPendingByNormalizedReference`).
 *
 *  - Uniqueness via a PLAIN partial unique index
 *    `(monthlyServiceId, normalizedReference) WHERE "deletedAt" IS NULL` —
 *    same proven pattern as migration `1741000013000`
 *    (`UQ_monthly_services_user_name_active`). Soft-deleted rows don't
 *    block re-adding a participant with the same reference.
 *
 *  - `defaultAmount` as `NUMERIC(14, 2)` with `CK_msp_default_amount_positive
 *    CHECK ("defaultAmount" > 0)` — same precision + positivity convention
 *    as `debts_loans.amount` (`CK_debts_loans_amount_positive`, migration
 *    `1741000028000`).
 *
 *  - `monthlyServiceId` is a real FK to `monthly_services` with
 *    `ON DELETE CASCADE` — a participant row has no meaning without its
 *    parent service, same convention as `debt_loan_payments.debtLoanId`
 *    (migration `1741000036000`).
 *
 *  - `userId` is a plain `uuid` column with NO FK — same decoupled-FK
 *    convention as `debts_loans.categoryId`. It denotes the OWNER of the
 *    service (redundant with `monthly_services.userId` but avoids a join
 *    on every ownership check from use cases that only load the
 *    participant).
 *
 *  - Index on `monthlyServiceId` for the per-service list query (the only
 *    read pattern in this slice: "list participants for service X").
 *
 *  - Soft-delete via `deletedAt` — same convention as `monthly_services`
 *    and `debts_loans`.
 */
export class CreateMonthlyServiceParticipantsTable1741000037000 implements MigrationInterface {
  name = 'CreateMonthlyServiceParticipantsTable1741000037000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "monthly_service_participants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "monthlyServiceId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "reference" varchar(255) NOT NULL,
        "normalizedReference" varchar(255) NOT NULL,
        "defaultAmount" numeric(14, 2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
        "deletedAt" timestamptz NULL,
        CONSTRAINT "FK_msp_monthly_service"
          FOREIGN KEY ("monthlyServiceId") REFERENCES "monthly_services"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_msp_default_amount_positive"
          CHECK ("defaultAmount" > 0)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_msp_participants_service" ON "monthly_service_participants" ("monthlyServiceId")`,
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_msp_participants_normalized_reference_active"
        ON "monthly_service_participants" ("monthlyServiceId", "normalizedReference")
        WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_msp_participants_normalized_reference_active"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_msp_participants_service"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "monthly_service_participants"`);
  }
}
