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
export class AddTargetCountToHabitLogs1741000040000 implements MigrationInterface {
  name = 'AddTargetCountToHabitLogs1741000040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "habit_logs" ADD COLUMN "targetCount" smallint`);

    // Completed logs: the count IS the old target. Exact recovery.
    await queryRunner.query(`
      UPDATE "habit_logs"
      SET "targetCount" = "count"
      WHERE "completed" = true AND "count" > 0
    `);

    // Everything else: fall back to the habit's current target.
    await queryRunner.query(`
      UPDATE "habit_logs" AS l
      SET "targetCount" = h."targetCount"
      FROM "habits" AS h
      WHERE l."habitId" = h."id" AND l."targetCount" IS NULL
    `);

    // Belt and braces: a log whose habit vanished (should not happen — the FK
    // prevents it) would still block the NOT NULL below.
    await queryRunner.query(`
      UPDATE "habit_logs" SET "targetCount" = 1 WHERE "targetCount" IS NULL
    `);

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
