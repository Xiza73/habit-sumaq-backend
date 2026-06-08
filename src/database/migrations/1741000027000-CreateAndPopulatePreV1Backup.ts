import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase T-PRE-2 of the `accounts-to-modular-finance` v1.0.0 refactor.
 *
 * **Belt-and-suspenders backup** of the two tables that get DROPPED in A7
 * (`accounts`, `transactions`) BEFORE any phase that mutates or deletes
 * their rows. The intent is row-level recovery if a bug shows up weeks
 * after A4-A6 land — Railway snapshots are DB-level (restore everything
 * or nothing), so this layer lets us hand-pick rows back into a fresh
 * table or onto disk without rolling back the whole prod DB.
 *
 * Schema rationale:
 *
 *  - **One generic table** `pre_v1_data_backup_v1` instead of one per
 *    source. Keeps the migration trivial and means if we later decide to
 *    add a third table to the backup set, no schema change needed.
 *
 *  - **One row per `(userId, tableName)`** with `rowsJson` holding all
 *    that user's rows for that table as a JSON array. Single-user-prod
 *    today means this is at most ~2 rows total; for multi-user it scales
 *    linearly with users and the JSON blob per user stays bounded by the
 *    individual user's data.
 *
 *  - **`UNIQUE (userId, tableName)` + `ON CONFLICT DO UPDATE`** in the
 *    populate step makes the migration idempotent — re-running it after
 *    a partial failure or a fresh dev reset re-snapshots cleanly.
 *
 *  - **Includes soft-deleted rows** (no `WHERE deletedAt IS NULL`) — full
 *    history preservation, otherwise we'd lose recovery for rows the
 *    user deleted intentionally before v1.0.0 ran. Recovery is a "look
 *    what was here" operation, not a "rehydrate live state" one, so
 *    soft-deletes belong in the snapshot.
 *
 *  - **`capturedAt`** timestamps each snapshot. If we ever re-run this
 *    migration mid-rollout (e.g., after a bug fix), the timestamp tells
 *    us which run produced which snapshot.
 *
 * Lifecycle:
 *
 *  - Created and populated NOW (T-PRE-2, before A3-B).
 *  - Survives A3 / A4 / A5 / A6 / A7 untouched.
 *  - **Manually dropped** a couple of weeks after v1.0.0 is stable in
 *    prod — not part of any phase. The expected SQL:
 *    `DROP TABLE pre_v1_data_backup_v1;`
 *
 * Down migration removes the table without trying to "restore" anything
 * — the source tables (`accounts`, `transactions`) are still alive when
 * this migration's down() runs (we're before A7), so there's nothing to
 * undo data-wise.
 */
export class CreateAndPopulatePreV1Backup1741000027000 implements MigrationInterface {
  name = 'CreateAndPopulatePreV1Backup1741000027000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pre_v1_data_backup_v1" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tableName" varchar(64) NOT NULL,
        "capturedAt" timestamptz NOT NULL DEFAULT NOW(),
        "rowCount" int NOT NULL,
        "rowsJson" jsonb NOT NULL,
        CONSTRAINT "UQ_pre_v1_data_backup_v1_user_table"
          UNIQUE ("userId", "tableName")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_pre_v1_data_backup_v1_user"
       ON "pre_v1_data_backup_v1" ("userId")`,
    );

    // Snapshot the `transactions` table, grouped per user. `jsonb_agg`
    // preserves array ordering by the GROUP BY's natural row order; we
    // don't need a specific order for recovery purposes, so an ORDER BY
    // would only add cost.
    await queryRunner.query(`
      INSERT INTO "pre_v1_data_backup_v1" ("userId", "tableName", "rowCount", "rowsJson")
      SELECT
        t."userId",
        'transactions',
        COUNT(*)::int,
        jsonb_agg(to_jsonb(t.*))
      FROM "transactions" t
      GROUP BY t."userId"
      ON CONFLICT ("userId", "tableName") DO UPDATE
      SET "rowCount" = EXCLUDED."rowCount",
          "rowsJson" = EXCLUDED."rowsJson",
          "capturedAt" = NOW()
    `);

    // Same shape for accounts. Even though A1-B.2 already aggregated
    // `accounts.balance` into `currency_pools`, the row-level state
    // (name, type, color, icon, archived, etc.) only lives in the
    // accounts table — and dies in A7. Capture it now.
    await queryRunner.query(`
      INSERT INTO "pre_v1_data_backup_v1" ("userId", "tableName", "rowCount", "rowsJson")
      SELECT
        a."userId",
        'accounts',
        COUNT(*)::int,
        jsonb_agg(to_jsonb(a.*))
      FROM "accounts" a
      GROUP BY a."userId"
      ON CONFLICT ("userId", "tableName") DO UPDATE
      SET "rowCount" = EXCLUDED."rowCount",
          "rowsJson" = EXCLUDED."rowsJson",
          "capturedAt" = NOW()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pre_v1_data_backup_v1_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pre_v1_data_backup_v1"`);
  }
}
