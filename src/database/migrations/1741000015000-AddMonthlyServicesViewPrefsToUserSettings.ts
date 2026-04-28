import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Adds three per-user view preferences for the monthly-services list. Stored
 * on `user_settings` (not a separate preferences table) because it's where
 * every other UI preference lives. Uses VARCHAR + CHECK rather than Postgres
 * ENUM types — these values are specific to the monthly-services UI and
 * unlikely to be reused elsewhere, so a global enum type would be overhead.
 *
 * Defaults are no-grouping + name ascending — matches the current UX.
 */
export class AddMonthlyServicesViewPrefsToUserSettings1741000015000 implements MigrationInterface {
  name = 'AddMonthlyServicesViewPrefsToUserSettings1741000015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD COLUMN "monthlyServicesGroupBy" varchar(20) NOT NULL DEFAULT 'none',
      ADD COLUMN "monthlyServicesOrderBy" varchar(24) NOT NULL DEFAULT 'name',
      ADD COLUMN "monthlyServicesOrderDir" varchar(4) NOT NULL DEFAULT 'asc'
    `);

    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD CONSTRAINT "CK_user_settings_msvc_group_by"
      CHECK ("monthlyServicesGroupBy" IN ('none', 'status', 'frequency', 'category'))
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD CONSTRAINT "CK_user_settings_msvc_order_by"
      CHECK ("monthlyServicesOrderBy" IN ('name', 'dueDay', 'nextDuePeriod', 'estimatedAmount', 'createdAt'))
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD CONSTRAINT "CK_user_settings_msvc_order_dir"
      CHECK ("monthlyServicesOrderDir" IN ('asc', 'desc'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      DROP CONSTRAINT IF EXISTS "CK_user_settings_msvc_order_dir",
      DROP CONSTRAINT IF EXISTS "CK_user_settings_msvc_order_by",
      DROP CONSTRAINT IF EXISTS "CK_user_settings_msvc_group_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      DROP COLUMN IF EXISTS "monthlyServicesOrderDir",
      DROP COLUMN IF EXISTS "monthlyServicesOrderBy",
      DROP COLUMN IF EXISTS "monthlyServicesGroupBy"
    `);
  }
}
