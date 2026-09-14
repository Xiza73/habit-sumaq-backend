import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Streak shields: the stock a user holds, and the record of which periods
 * they spent one on.
 *
 * The rescues live in their own table rather than as synthetic `habit_logs`
 * rows, and that is the whole design. A streak is not stored anywhere — it is
 * derived from the logs on every read — so the tempting shortcut is to write a
 * completed log for the missed day and let the existing walk bridge it. That
 * would corrupt the record: the completion rate would count a day the user did
 * not do, the calendar would show it as done, and the longest streak would
 * inflate. Keeping rescues separate lets `StatsCalculator` bridge the streak
 * while every honesty metric keeps reading the logs alone.
 *
 * `rescuedDate` is a DATE, not a period key. A habit can switch DAILY↔WEEKLY,
 * and a stored `2026-W37` would be orphaned the moment it did; a date resolves
 * through the same helpers the logs go through, whatever the frequency is now.
 * For a WEEKLY habit it is the Monday of the rescued week.
 *
 * The UNIQUE on `(habitId, rescuedDate)` is what makes rescuing the same
 * period twice impossible — not a policy check in application code that a
 * future caller could forget to run.
 */
export class CreateHabitStreakRescues1741000046000 implements MigrationInterface {
  name = 'CreateHabitStreakRescues1741000046000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "habit_streak_rescues" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "habitId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "rescuedDate" date NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_habit_streak_rescues" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_habit_streak_rescues_habit_date" UNIQUE ("habitId", "rescuedDate"),
        CONSTRAINT "FK_habit_streak_rescues_habit" FOREIGN KEY ("habitId")
          REFERENCES "habits"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_habit_streak_rescues_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Every read of a habit's stats loads its rescues, so the lookup is by
    // habit. The unique above already indexes (habitId, rescuedDate), which
    // serves that prefix — no extra index needed.

    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD COLUMN "streakShields" smallint NOT NULL DEFAULT 0
    `);

    // Hard cap at the DB level so a bug in the grant path cannot hand out an
    // unbounded stock. The cap is what gives a shield its weight.
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD CONSTRAINT "CK_user_settings_streak_shields_range"
      CHECK ("streakShields" >= 0 AND "streakShields" <= 2)
    `);

    // 'YYYY-MM' of the month a shield was last granted. Null = never. One
    // column instead of a grants table because the only question ever asked is
    // "was one already granted this month".
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD COLUMN "shieldsEarnedMonth" varchar(7)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "shieldsEarnedMonth"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      DROP CONSTRAINT IF EXISTS "CK_user_settings_streak_shields_range"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "streakShields"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "habit_streak_rescues"`);
  }
}
