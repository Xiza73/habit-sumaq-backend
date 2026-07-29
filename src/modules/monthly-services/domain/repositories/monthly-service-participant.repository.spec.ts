import { MonthlyServiceParticipant } from '../entities/monthly-service-participant.entity';

import { MonthlyServiceParticipantRepository } from './monthly-service-participant.repository';

function buildParticipant(overrides: Partial<{ id: string; normalizedReference: string }> = {}) {
  const now = new Date('2026-07-27T12:00:00.000Z');
  return new MonthlyServiceParticipant({
    id: overrides.id ?? 'participant-1',
    monthlyServiceId: 'service-1',
    userId: 'user-1',
    reference: 'Ana',
    normalizedReference: overrides.normalizedReference ?? 'ana',
    defaultAmount: 100,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

/**
 * Contract test for the abstract repository — exercised through a minimal
 * in-memory mock implementation. Proves the abstract class shape (method
 * names + signatures) is usable and behaves as documented, without
 * depending on TypeORM/Postgres (that's the `.impl.spec.ts` layer).
 */
class InMemoryMonthlyServiceParticipantRepository extends MonthlyServiceParticipantRepository {
  private rows: MonthlyServiceParticipant[] = [];

  findByServiceId(monthlyServiceId: string): Promise<MonthlyServiceParticipant[]> {
    return Promise.resolve(
      this.rows.filter((r) => r.monthlyServiceId === monthlyServiceId && !r.isDeleted()),
    );
  }

  findByNormalizedReference(
    monthlyServiceId: string,
    normalizedReference: string,
  ): Promise<MonthlyServiceParticipant | null> {
    return Promise.resolve(
      this.rows.find(
        (r) =>
          r.monthlyServiceId === monthlyServiceId &&
          r.normalizedReference === normalizedReference &&
          !r.isDeleted(),
      ) ?? null,
    );
  }

  save(participant: MonthlyServiceParticipant): Promise<MonthlyServiceParticipant> {
    this.rows = this.rows.filter((r) => r.id !== participant.id);
    this.rows.push(participant);
    return Promise.resolve(participant);
  }

  softDelete(id: string): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.deletedAt = new Date();
    return Promise.resolve();
  }
}

describe('MonthlyServiceParticipantRepository (contract)', () => {
  let repo: InMemoryMonthlyServiceParticipantRepository;

  beforeEach(() => {
    repo = new InMemoryMonthlyServiceParticipantRepository();
  });

  it('findByServiceId returns only rows for the given service', async () => {
    await repo.save(buildParticipant({ id: 'p1' }));
    await repo.save(
      new MonthlyServiceParticipant({
        id: 'p2',
        monthlyServiceId: 'other-service',
        userId: 'user-1',
        reference: 'Luis',
        normalizedReference: 'luis',
        defaultAmount: 80,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }),
    );

    const result = await repo.findByServiceId('service-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('findByNormalizedReference finds a matching active row', async () => {
    await repo.save(buildParticipant({ id: 'p1', normalizedReference: 'ana' }));

    const found = await repo.findByNormalizedReference('service-1', 'ana');

    expect(found).not.toBeNull();
    expect(found?.id).toBe('p1');
  });

  it('findByNormalizedReference returns null when soft-deleted', async () => {
    await repo.save(buildParticipant({ id: 'p1', normalizedReference: 'ana' }));
    await repo.softDelete('p1');

    const found = await repo.findByNormalizedReference('service-1', 'ana');

    expect(found).toBeNull();
  });

  it('softDelete excludes the row from findByServiceId', async () => {
    await repo.save(buildParticipant({ id: 'p1' }));

    await repo.softDelete('p1');
    const result = await repo.findByServiceId('service-1');

    expect(result).toHaveLength(0);
  });
});
