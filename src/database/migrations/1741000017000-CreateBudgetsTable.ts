import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateBudgetsTable1741000017000 implements MigrationInterface {
  name = 'CreateBudgetsTable1741000017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "budgets" (
        "id"          uuid                      NOT NULL DEFAULT gen_random_uuid(),
        "userId"      uuid                      NOT NULL,
        "year"        integer                   NOT NULL,
        "month"       integer                   NOT NULL,
        "currency"    character varying(3)      NOT NULL,
        "amount"      numeric(15,2)             NOT NULL,
        "createdAt"   TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "deletedAt"   TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_budgets"           PRIMARY KEY ("id"),
        CONSTRAINT "FK_budgets_users"     FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_budgets_month"     CHECK ("month" BETWEEN 1 AND 12),
        CONSTRAINT "CK_budgets_year"      CHECK ("year" BETWEEN 2000 AND 2100),
        CONSTRAINT "CK_budgets_amount"    CHECK ("amount" > 0)
      )
    `);

    // Unique only among non-soft-deleted rows so the user can re-create a
    // budget for the same period after deleting one (deleted rows live in
    // the table for audit but no longer block creation).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_budgets_user_period_currency"
        ON "budgets" ("userId", "year", "month", "currency")
        WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`CREATE INDEX "IDX_budgets_userId" ON "budgets" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_budgets_userId_year_month" ON "budgets" ("userId", "year", "month")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_budgets_userId_year_month"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_budgets_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_budgets_user_period_currency"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "budgets"`);
  }
}
