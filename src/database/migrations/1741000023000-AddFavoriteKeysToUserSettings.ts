import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Adds `favoriteKeys` (text[]) to `user_settings`. Drives the new
 * favoritable nav UX:
 *  - Mobile bottom nav renders these (max 4) + a fixed Settings slot.
 *  - Web sidebar renders a small star next to items whose key is in this
 *    list (the sidebar still shows everything; favorites are just marked).
 *
 * Stored as a Postgres `text[]` (not JSON / JSONB) because order matters
 * (the user picks the slot order on mobile) and we want simple equality
 * checks. Strings are deliberately not constrained to a known set in
 * SQL — the canonical list of nav keys lives in the frontend's
 * `NAV_REGISTRY`. The frontend ignores unknown keys gracefully, so we can
 * add/remove nav routes without lockstep migrations.
 *
 * Default: `['accounts','transactions','habits','quick-tasks']` — the four
 * items the mobile bottom nav already shows today. Existing users get
 * this default at migration time (no per-user backfill needed beyond the
 * column default).
 */
export class AddFavoriteKeysToUserSettings1741000023000 implements MigrationInterface {
  name = 'AddFavoriteKeysToUserSettings1741000023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD COLUMN "favoriteKeys" text[] NOT NULL
        DEFAULT ARRAY['accounts','transactions','habits','quick-tasks']::text[]
    `);

    // Cap at 4 entries — same cap the DTO enforces. Belt-and-suspenders:
    // direct SQL writes (e.g. an admin tool) can't accidentally bypass the
    // application-layer validator. Empty arrays are allowed (user can
    // clear all favorites; mobile then renders only the Settings slot).
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD CONSTRAINT "CK_user_settings_favorite_keys_max_4"
      CHECK (array_length("favoriteKeys", 1) IS NULL OR array_length("favoriteKeys", 1) <= 4)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      DROP CONSTRAINT IF EXISTS "CK_user_settings_favorite_keys_max_4"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      DROP COLUMN IF EXISTS "favoriteKeys"
    `);
  }
}
