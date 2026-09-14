import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Adds `disabledModules` (text[]) to `user_settings`. Drives the "enable /
 * disable modules" section in Settings: a key listed here is hidden from the
 * sidebar and mobile nav, from its slice of the reports dashboards, and from
 * the alerts popover.
 *
 * Stored as `text[]` and NOT constrained to a known set in SQL, for the same
 * reason `favoriteKeys` isn't (migration 1741000023000): the canonical list of
 * modules lives in the frontend's `NAV_REGISTRY`, and keeping this side
 * dumb-strings means a nav route can be added or renamed without a lockstep
 * backend migration. The frontend ignores keys it does not recognise.
 *
 * Default is an EMPTY array — every module on. Opting out is the exception, so
 * the default has to be "nothing disabled": a default naming modules would
 * turn every future module addition into a decision about existing users.
 *
 * Deliberately NOT capped, unlike `favoriteKeys`. There is no upper bound worth
 * enforcing — disabling every module is a legitimate (if odd) state, and
 * Settings itself is never in this list, so the user can always get back.
 */
export class AddDisabledModulesToUserSettings1741000045000 implements MigrationInterface {
  name = 'AddDisabledModulesToUserSettings1741000045000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD COLUMN "disabledModules" text[] NOT NULL DEFAULT '{}'::text[]
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      DROP COLUMN IF EXISTS "disabledModules"
    `);
  }
}
