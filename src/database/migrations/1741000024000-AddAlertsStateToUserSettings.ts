import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Adds the persistent state behind the in-app alerts feature:
 *
 *  - `user_settings.lastAlertsSeenAt` (timestamptz, nullable) — bumped to
 *    NOW() whenever the user opens the alerts popover. Drives the bell
 *    badge: an alert is unread when its `triggeredAt` is newer than this.
 *    Null = the user has never opened the popover.
 *
 *  - `user_alert_dismissals` table — holds the per-day dismiss state for
 *    alerts whose policy is `per-day` (e.g. service-due-today,
 *    habits-midday). A row hides its `alertId` from the user's bell list
 *    until `expiresAt`. Persistent-policy alerts (overdue services /
 *    chores, overspent budgets) never write here — the use case rejects
 *    those with `ALR_001`.
 *
 *  - Unique `(userId, alertId)` keeps a second dismiss of the same alert
 *    from inserting a duplicate row. Use-case-level upserts target it
 *    explicitly.
 *
 *  - Index on `(userId, expiresAt)` so the GET-alerts filter (`WHERE
 *    userId = $1 AND expiresAt > NOW()`) stays cheap as the table grows.
 *    Stale rows are never deleted server-side (cheap rows, no cron) — the
 *    index keeps the active subset hot regardless.
 */
export class AddAlertsStateToUserSettings1741000024000 implements MigrationInterface {
  name = 'AddAlertsStateToUserSettings1741000024000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD COLUMN "lastAlertsSeenAt" timestamptz NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "user_alert_dismissals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "alertId" varchar(128) NOT NULL,
        "dismissedAt" timestamptz NOT NULL DEFAULT NOW(),
        "expiresAt" timestamptz NULL,
        CONSTRAINT "UQ_user_alert_dismissals_user_alert"
          UNIQUE ("userId", "alertId")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_user_alert_dismissals_user_expires"
       ON "user_alert_dismissals" ("userId", "expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_alert_dismissals_user_expires"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_alert_dismissals"`);
    await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "lastAlertsSeenAt"`);
  }
}
