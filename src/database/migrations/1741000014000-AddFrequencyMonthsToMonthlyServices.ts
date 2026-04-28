import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Adds `frequencyMonths` to monthly_services so a service can be billed every
 * 1 / 3 / 6 / 12 months (mensual / trimestral / semestral / anual). Existing
 * rows default to 1 (mensual) so the change is transparent for current users.
 *
 * Restricted to the four canonical cadences via a CHECK constraint — same
 * shape as the dueDay range check.
 */
export class AddFrequencyMonthsToMonthlyServices1741000014000 implements MigrationInterface {
  name = 'AddFrequencyMonthsToMonthlyServices1741000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "monthly_services"
      ADD COLUMN "frequencyMonths" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "monthly_services"
      ADD CONSTRAINT "CK_monthly_services_frequency_months"
      CHECK ("frequencyMonths" IN (1, 3, 6, 12))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "monthly_services"
      DROP CONSTRAINT IF EXISTS "CK_monthly_services_frequency_months"
    `);
    await queryRunner.query(`
      ALTER TABLE "monthly_services"
      DROP COLUMN IF EXISTS "frequencyMonths"
    `);
  }
}
