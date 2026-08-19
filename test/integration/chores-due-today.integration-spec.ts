import { randomUUID } from 'node:crypto';

import { IntervalUnit } from '../../src/modules/chores/domain/enums/interval-unit.enum';
import { ChoreOrmEntity } from '../../src/modules/chores/infrastructure/persistence/chore.orm-entity';
import { ChoreRepositoryImpl } from '../../src/modules/chores/infrastructure/persistence/chore.repository.impl';
import { UserOrmEntity } from '../../src/modules/users/infrastructure/persistence/user.orm-entity';

import { TestDataSource } from './data-source';
import { closeTestDatabase, initTestDatabase } from './harness';

/**
 * Answers one question that no mocked test can: what does a Postgres `date`
 * column actually hand back through TypeORM?
 *
 * It matters because the two chore alert triggers compare it differently:
 *
 *   isOverdueFor()   →  this.nextDueDate < today      (loose, coercing)
 *   chore-due-today  →  chore.nextDueDate === today   (strict)
 *
 * `pg` parses `date` (OID 1082) into a JS `Date` unless a type parser says
 * otherwise. If that happened here, the loose `<` would still produce SOME
 * result while the strict `===` could never match — which would look exactly
 * like the reported symptom: overdue alerts arrive, due-today ones never do.
 *
 * Every unit test in the alerts module feeds the builder a plain string, so
 * they all pass either way and prove nothing about this.
 */

const USER = '00000000-0000-4000-8000-0000000000c1';

jest.setTimeout(30_000);

beforeAll(async () => {
  await initTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

beforeEach(async () => {
  // `chores` carries an FK to `users`, unlike `debts_loans` — so the user has
  // to exist before any chore can be inserted. CASCADE on `users` clears the
  // chores along with it.
  await TestDataSource.query('TRUNCATE "users" CASCADE');
  await TestDataSource.getRepository(UserOrmEntity).save({
    id: USER,
    googleId: `google-${USER}`,
    email: `${USER}@example.test`,
    name: 'Integration user',
    avatarUrl: null,
    isActive: true,
  } as UserOrmEntity);
});

async function seedChore(nextDueDate: string): Promise<string> {
  const id = randomUUID();
  await TestDataSource.getRepository(ChoreOrmEntity).save({
    id,
    userId: USER,
    name: 'Regar las plantas',
    notes: null,
    category: null,
    intervalValue: 1,
    intervalUnit: IntervalUnit.WEEKS,
    startDate: nextDueDate,
    lastDoneDate: null,
    nextDueDate,
    isActive: true,
  } as ChoreOrmEntity);
  return id;
}

describe('chore nextDueDate round-trip through Postgres', () => {
  const repo = () => new ChoreRepositoryImpl(TestDataSource.getRepository(ChoreOrmEntity));

  it('comes back as a YYYY-MM-DD string, not a Date', async () => {
    await seedChore('2026-05-19');

    const [chore] = await repo().findByUserId(USER, false);

    // The assertion the whole due-today trigger rests on. A `Date` here would
    // silently break `===` while leaving `<` limping along.
    expect(typeof chore.nextDueDate).toBe('string');
    expect(chore.nextDueDate).toBe('2026-05-19');
  });

  it('satisfies strict equality against a formatted today, which is what the alert uses', async () => {
    const today = '2026-05-19';
    await seedChore(today);

    const [chore] = await repo().findByUserId(USER, false);

    expect(chore.nextDueDate === today).toBe(true);
    expect(chore.isOverdueFor(today)).toBe(false);
  });

  it('still reports overdue for an earlier date', async () => {
    await seedChore('2026-05-15');

    const [chore] = await repo().findByUserId(USER, false);

    expect(chore.isOverdueFor('2026-05-19')).toBe(true);
    expect(chore.nextDueDate === '2026-05-19').toBe(false);
  });

  it('keeps the two triggers mutually exclusive on real data', async () => {
    const today = '2026-05-19';
    await seedChore(today); // due today
    await seedChore('2026-05-15'); // overdue

    const chores = await repo().findByUserId(USER, false);

    const dueToday = chores.filter((c) => !c.isOverdueFor(today) && c.nextDueDate === today);
    const overdue = chores.filter((c) => c.isOverdueFor(today));

    expect(dueToday).toHaveLength(1);
    expect(overdue).toHaveLength(1);
    // No chore may land in both buckets — that is the invariant the alert
    // builder's `continue` depends on.
    expect(dueToday[0].id).not.toBe(overdue[0].id);
  });
});
