import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Every user starts holding one streak shield.
 *
 * The mechanic only teaches itself when a streak is actually at risk, and until
 * then a user with zero shields sees a rescue button they cannot press. Handing
 * one out up front means the first time it matters, it works.
 *
 * The backfill is deliberately narrow: `streakShields = 0 AND
 * shieldsEarnedMonth IS NULL` is "never touched the mechanic". A blanket
 * `SET streakShields = 1` would DEMOTE anyone holding two and re-gift anyone who
 * already spent theirs this month — rewriting a game in progress.
 */
export class StartUsersWithOneStreakShield1741000047000 implements MigrationInterface {
  name = 'StartUsersWithOneStreakShield1741000047000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_settings
      ALTER COLUMN "streakShields" SET DEFAULT 1
    `);

    await queryRunner.query(`
      UPDATE user_settings
      SET "streakShields" = 1, "updatedAt" = now()
      WHERE "streakShields" = 0 AND "shieldsEarnedMonth" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_settings
      ALTER COLUMN "streakShields" SET DEFAULT 0
    `);

    // The granted shields are NOT taken back. By the time this runs some of
    // them have been spent on real rescues, and there is no way to tell those
    // apart from the ones still sitting untouched — clawing back the stock
    // would delete protection the user already used.
  }
}
