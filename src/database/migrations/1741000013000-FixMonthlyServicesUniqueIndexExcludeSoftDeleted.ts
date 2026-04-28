import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Soft-deleted services were still blocking the active-name uniqueness
 * partial unique index because `softDelete()` only sets `deletedAt`, leaving
 * `isActive=true` intact. This made it impossible to recreate a service with
 * the same name once you deleted it — even though it no longer appears in any
 * query (TypeORM's `find()` excludes soft-deleted rows automatically).
 *
 * Fix: extend the WHERE clause of the partial unique index to also exclude
 * soft-deleted rows.
 */
export class FixMonthlyServicesUniqueIndexExcludeSoftDeleted1741000013000 implements MigrationInterface {
  name = 'FixMonthlyServicesUniqueIndexExcludeSoftDeleted1741000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_monthly_services_user_name_active"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_monthly_services_user_name_active"
        ON "monthly_services" ("userId", "name")
        WHERE "isActive" = true AND "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_monthly_services_user_name_active"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_monthly_services_user_name_active"
        ON "monthly_services" ("userId", "name")
        WHERE "isActive" = true
    `);
  }
}
