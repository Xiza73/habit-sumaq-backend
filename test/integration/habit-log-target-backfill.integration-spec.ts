import { randomUUID } from 'node:crypto';

import {
  BACKFILL_COMPLETED_FROM_COUNT,
  BACKFILL_ORPHANS,
  BACKFILL_REMAINDER_FROM_HABIT,
} from '../../src/database/migrations/1741000040000-AddTargetCountToHabitLogs';
import { HabitFrequency } from '../../src/modules/habits/domain/enums/habit-frequency.enum';
import { HabitOrmEntity } from '../../src/modules/habits/infrastructure/persistence/habit.orm-entity';
import { UserOrmEntity } from '../../src/modules/users/infrastructure/persistence/user.orm-entity';

import { TestDataSource } from './data-source';
import { closeTestDatabase, initTestDatabase } from './harness';

/**
 * Verifies the per-day-target backfill against real rows.
 *
 * A migration runs once, on an empty CI database — which proves the SQL parses
 * and nothing about what it does to data. This seeds the shapes that exist in
 * production, re-runs the exact exported statements, and asserts the outcome.
 *
 * The claim under test is that for COMPLETED logs the historical target is
 * recovered EXACTLY rather than guessed: `LogHabitUseCase` capped the stored
 * count at the target and only set `completed` when `count >= target`, so a
 * completed log necessarily has `count === target-at-the-time`.
 */

const USER = '00000000-0000-4000-8000-0000000000d1';

jest.setTimeout(30_000);

beforeAll(async () => {
  await initTestDatabase();
  // The migration has already run here, so the column is NOT NULL with a
  // CHECK — the very state the backfill exists to reach. Reproducing the
  // pre-migration shape means standing both down for the duration of this
  // suite, then putting them back so later specs see the real schema.
  await TestDataSource.query(
    `ALTER TABLE "habit_logs" DROP CONSTRAINT IF EXISTS "CHK_habit_logs_targetCount_positive"`,
  );
  await TestDataSource.query(`ALTER TABLE "habit_logs" ALTER COLUMN "targetCount" DROP NOT NULL`);
});

afterAll(async () => {
  if (TestDataSource.isInitialized) {
    await TestDataSource.query('TRUNCATE "users" CASCADE');
    await TestDataSource.query(
      `ALTER TABLE "habit_logs" ALTER COLUMN "targetCount" SET NOT NULL`,
    );
    await TestDataSource.query(
      `ALTER TABLE "habit_logs" ADD CONSTRAINT "CHK_habit_logs_targetCount_positive" CHECK ("targetCount" >= 1)`,
    );
  }
  await closeTestDatabase();
});

beforeEach(async () => {
  await TestDataSource.query('TRUNCATE "users" CASCADE');
  await TestDataSource.getRepository(UserOrmEntity).save({
    id: USER,
    googleId: `google-${USER}`,
    email: `${USER}@example.test`,
    name: 'Backfill user',
    isActive: true,
  } as UserOrmEntity);
});

async function seedHabit(targetCount: number): Promise<string> {
  const id = randomUUID();
  await TestDataSource.getRepository(HabitOrmEntity).save({
    id,
    userId: USER,
    name: `Habit ${targetCount}`,
    description: null,
    frequency: HabitFrequency.DAILY,
    targetCount,
    color: '#000000',
    icon: null,
    isArchived: false,
  } as HabitOrmEntity);
  return id;
}

/** Inserts a log with `targetCount` NULL, i.e. the pre-migration shape. */
async function seedLegacyLog(
  habitId: string,
  date: string,
  count: number,
  completed: boolean,
): Promise<string> {
  const id = randomUUID();
  await TestDataSource.query(
    `INSERT INTO "habit_logs" ("id", "habitId", "userId", "date", "count", "completed", "note", "targetCount")
     VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL)`,
    [id, habitId, USER, date, count, completed],
  );
  return id;
}

async function runBackfill(): Promise<void> {
  await TestDataSource.query(BACKFILL_COMPLETED_FROM_COUNT);
  await TestDataSource.query(BACKFILL_REMAINDER_FROM_HABIT);
  await TestDataSource.query(BACKFILL_ORPHANS);
}

async function targetOf(logId: string): Promise<number> {
  const rows = await TestDataSource.query<Array<{ targetCount: number }>>(
    `SELECT "targetCount" FROM "habit_logs" WHERE "id" = $1`,
    [logId],
  );
  return Number(rows[0].targetCount);
}

describe('per-day target backfill', () => {
  it('recovers the historical target EXACTLY for a completed log', async () => {
    // The habit is on 4 today, but this day was finished when it was 3.
    // Without the count-based recovery it would read "3/4" forever.
    const habitId = await seedHabit(4);
    const logId = await seedLegacyLog(habitId, '2026-05-10', 3, true);

    await runBackfill();

    expect(await targetOf(logId)).toBe(3);
  });

  it('falls back to the habit target for an incomplete log', async () => {
    // `count < target` reveals nothing about the old target, so the habit's
    // current one is the best available answer — and it is what the UI was
    // already showing for that day.
    const habitId = await seedHabit(4);
    const logId = await seedLegacyLog(habitId, '2026-05-11', 1, false);

    await runBackfill();

    expect(await targetOf(logId)).toBe(4);
  });

  it('does not let the count rule touch a zero-count completed log', async () => {
    // `completed` with `count = 0` should not exist, but a 0 target would
    // violate the CHECK constraint, so the guard matters.
    const habitId = await seedHabit(4);
    const logId = await seedLegacyLog(habitId, '2026-05-12', 0, true);

    await runBackfill();

    expect(await targetOf(logId)).toBe(4);
  });

  it('leaves no NULL behind, so the NOT NULL can be applied', async () => {
    const habitId = await seedHabit(6);
    await seedLegacyLog(habitId, '2026-05-13', 6, true);
    await seedLegacyLog(habitId, '2026-05-14', 2, false);
    await seedLegacyLog(habitId, '2026-05-15', 0, false);

    await runBackfill();

    const [{ nulls }] = await TestDataSource.query<Array<{ nulls: string }>>(
      `SELECT COUNT(*) AS nulls FROM "habit_logs" WHERE "targetCount" IS NULL`,
    );
    expect(Number(nulls)).toBe(0);
  });

  it('keeps every backfilled value at or above 1, satisfying the CHECK', async () => {
    const habitId = await seedHabit(3);
    await seedLegacyLog(habitId, '2026-05-16', 3, true);
    await seedLegacyLog(habitId, '2026-05-17', 0, false);

    await runBackfill();

    const [{ below }] = await TestDataSource.query<Array<{ below: string }>>(
      `SELECT COUNT(*) AS below FROM "habit_logs" WHERE "targetCount" < 1`,
    );
    expect(Number(below)).toBe(0);
  });

  it('resolves each habit against its own target, not a shared one', async () => {
    const lowHabit = await seedHabit(2);
    const highHabit = await seedHabit(9);
    const lowLog = await seedLegacyLog(lowHabit, '2026-05-18', 1, false);
    const highLog = await seedLegacyLog(highHabit, '2026-05-18', 4, false);

    await runBackfill();

    expect(await targetOf(lowLog)).toBe(2);
    expect(await targetOf(highLog)).toBe(9);
  });
});
