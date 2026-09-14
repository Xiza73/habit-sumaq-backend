import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Realigns the `user_settings.favoriteKeys` default with the modules that
 * actually exist after the v1.0.0 refactor.
 *
 * Migration 1741000023000 shipped `['accounts','transactions','habits',
 * 'quick-tasks']` — the four items the mobile bottom nav showed at the time.
 * `accounts` and `transactions` were then dropped (A6-W.5 and A6-W.3), and
 * the frontend moved its own `DEFAULT_FAVORITES` to `['debts','budgets',
 * 'habits','quick-tasks']` (`src/lib/nav-registry.ts`). This column never
 * followed, so the two defaults diverged.
 *
 * The divergence is not cosmetic. The frontend drops keys it does not know,
 * so a new user renders only 2 of the 4 mobile slots — but `favoriteKeys`
 * still has length 4, which trips the `MAX_FAVORITES` cap. They cannot add a
 * favorite (the cap rejects it), and they cannot remove the two dead ones
 * either: an unrendered item has no row to right-click. Soft-locked.
 *
 * The same reasoning applies to users created before this migration, so the
 * dead keys are stripped from existing rows rather than only fixing the
 * default for new ones. Only `accounts` and `transactions` are removed —
 * every other key the user picked is preserved, in order.
 */
export class AlignFavoriteKeysDefaultWithV1Modules1741000044000 implements MigrationInterface {
  name = 'AlignFavoriteKeysDefaultWithV1Modules1741000044000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ALTER COLUMN "favoriteKeys"
        SET DEFAULT ARRAY['debts','budgets','habits','quick-tasks']::text[]
    `);

    // `array_remove` preserves the order of what survives, which matters —
    // the array order IS the mobile slot order. Rows that never held a dead
    // key are left untouched by the WHERE clause.
    await queryRunner.query(`
      UPDATE "user_settings"
      SET "favoriteKeys" = array_remove(
        array_remove("favoriteKeys", 'accounts'),
        'transactions'
      )
      WHERE "favoriteKeys" && ARRAY['accounts','transactions']::text[]
    `);
  }

  /**
   * Restores the old default only. The stripped keys are NOT put back: they
   * name routes that no longer exist, so re-adding them would reintroduce
   * the soft-lock, and there is no record of which rows held them before.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ALTER COLUMN "favoriteKeys"
        SET DEFAULT ARRAY['accounts','transactions','habits','quick-tasks']::text[]
    `);
  }
}
