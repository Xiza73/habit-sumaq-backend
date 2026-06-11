import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase A7-B — the FINAL step of the v1.0.0 `accounts-to-modular-finance`
 * refactor. Physically drops the legacy `accounts` and `transactions`
 * tables, plus the `monthly_services.defaultAccountId` column.
 *
 * Until now the legacy tables stayed alive in the database (no code read
 * from them after A6-B, but the rows were untouched) so any rollback
 * could restore the pre-refactor behavior cheaply. After v0.4.0 ran in
 * production without regressions, that safety net is no longer needed.
 *
 * **POINT OF NO RETURN.** This migration is intentionally one-way:
 *
 *   - The legacy row data IS NOT preserved in the new modules — those
 *     rows were already backfilled into `currency_pools`, `debts_loans`,
 *     `budget_movements`, and `monthly_service_payments` between A2-A4.
 *     What this migration drops is the SOURCE table, not the data.
 *   - The full pre-v1.0.0 snapshot still lives in
 *     `pre_v1_data_backup_v1` (created by migration 1741000027000),
 *     which is the only path to recover legacy rows if a downstream
 *     module discovers a backfill bug.
 *
 * Order matters — FK constraints have to come off before the tables:
 *   1. Drop `FK_monthly_services_default_acc` and the column it covers.
 *   2. Drop `transactions` (it FK-references `accounts` via accountId
 *      AND destinationAccountId; both go with the table).
 *   3. Drop `accounts`.
 *   4. Drop the enum types only the legacy tables used.
 *
 * `currency_enum` is intentionally kept — `currency_pools`,
 * `debts_loans`, `budget_movements`, and `monthly_service_payments`
 * all still use it.
 */
export class DropLegacyAccountsAndTransactions1741000035000 implements MigrationInterface {
  name = 'DropLegacyAccountsAndTransactions1741000035000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. monthly_services.defaultAccountId — column + its FK to accounts.
    //    The FK has to come off first or DROP COLUMN fails on ON DELETE RESTRICT.
    await queryRunner.query(`
      ALTER TABLE "monthly_services"
        DROP CONSTRAINT IF EXISTS "FK_monthly_services_default_acc"
    `);
    await queryRunner.query(`
      ALTER TABLE "monthly_services"
        DROP COLUMN IF EXISTS "defaultAccountId"
    `);

    // 2. transactions — drop the whole table, including its indexes and
    //    child enum (transaction_status_enum was added in
    //    1741000004000-AddDebtLoanFields and is used ONLY here).
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transaction_status_enum"`);

    // 3. accounts.
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "account_type_enum"`);

    // Note: `currency_enum` is NOT dropped — still referenced by the
    // v1.0.0 modules (currency_pools, debts_loans, etc).
  }

  /**
   * Reverting this migration is NOT supported. The legacy tables are
   * gone and re-creating their schema would not bring back the row data.
   *
   * If a recovery is genuinely needed:
   *   1. Restore `accounts` and `transactions` rows from
   *      `pre_v1_data_backup_v1` (snapshot table created by migration
   *      1741000027000-CreateAndPopulatePreV1Backup).
   *   2. Recreate the schema by checking out the v0.4.0 tag and running
   *      `pnpm typeorm migration:run` against an empty database that
   *      stops one migration before this one.
   *   3. Replay the user data on top.
   *
   * Throwing here is intentional — a silent no-op `down()` would let
   * `migration:revert` succeed without restoring anything, which is the
   * opposite of what the operator wants in a recovery scenario.
   */
  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Migration DropLegacyAccountsAndTransactions1741000035000 is irreversible. ' +
          'Recovery requires restoring legacy rows from pre_v1_data_backup_v1 manually. ' +
          'See the migration comment for the recovery procedure.',
      ),
    );
  }
}
