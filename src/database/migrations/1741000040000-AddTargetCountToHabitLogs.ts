import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Gives every habit log its own target, so changing a habit's target stops
 * rewriting history.
 *
 * Before this, the denominator shown for a past day came from `habits.targetCount`
 * live. Raising a habit from 3 to 4 turned every previously-completed day into
 * "3/4" — days the user had genuinely finished suddenly read as unfinished.
 *
 * ## Backfill
 *
 * For COMPLETED logs the original target is recoverable EXACTLY, not
 * approximated. `LogHabitUseCase` capped the stored count at the target
 * (`min(count, target)`) and only set `completed` when `count >= target`, so a
 * completed log necessarily has `count === target-at-the-time`. Copying `count`
 * restores the real historical target.
 *
 * For INCOMPLETE logs it is genuinely unrecoverable: `count < target` says
 * nothing about what the target was. Those fall back to the habit's current
 * target, which is the best available guess and matches what the UI was
 * already showing them.
 *
 * WEEKLY habits are deliberately untouched by the read path (their target
 * belongs to the week, not to any single log), but the column is still
 * backfilled for them so it can be NOT NULL and so a future weekly design has
 * data to work with.
 */
/**
 * The backfill statements, exported so the integration suite can run them
 * against seeded rows and assert the outcome.
 *
 * A migration only ever runs once, on an empty database in CI — which proves
 * the SQL parses and nothing more. These being shared means the behaviour the
 * test pins is the behaviour that shipped, with no second copy to drift.
 */
export const BACKFILL_COMPLETED_FROM_COUNT = `
  UPDATE "habit_logs"
  SET "targetCount" = "count"
  WHERE "completed" = true AND "count" > 0
`;

export const BACKFILL_REMAINDER_FROM_HABIT = `
  UPDATE "habit_logs" AS l
  SET "targetCount" = h."targetCount"
  FROM "habits" AS h
  WHERE l."habitId" = h."id" AND l."targetCount" IS NULL
`;

export const BACKFILL_ORPHANS = `
  UPDATE "habit_logs" SET "targetCount" = 1 WHERE "targetCount" IS NULL
`;

export class AddTargetCountToHabitLogs1741000040000 implements MigrationInterface {
  name = 'AddTargetCountToHabitLogs1741000040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "habit_logs" ADD COLUMN "targetCount" smallint`);

    // Completed logs: the count IS the old target. Exact recovery.
    await queryRunner.query(BACKFILL_COMPLETED_FROM_COUNT);

    // Everything else: fall back to the habit's current target.
    await queryRunner.query(BACKFILL_REMAINDER_FROM_HABIT);

    // Belt and braces: a log whose habit vanished (should not happen — the FK
    // prevents it) would still block the NOT NULL below.
    await queryRunner.query(BACKFILL_ORPHANS);

    await queryRunner.query(`ALTER TABLE "habit_logs" ALTER COLUMN "targetCount" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "habit_logs" ADD CONSTRAINT "CHK_habit_logs_targetCount_positive" CHECK ("targetCount" >= 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "habit_logs" DROP CONSTRAINT "CHK_habit_logs_targetCount_positive"`,
    );
    await queryRunner.query(`ALTER TABLE "habit_logs" DROP COLUMN "targetCount"`);
  }
}
