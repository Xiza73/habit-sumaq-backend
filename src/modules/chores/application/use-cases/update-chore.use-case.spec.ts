import { DomainException } from '@common/exceptions/domain.exception';

import { buildChore } from '../../domain/__tests__/chore.factory';
import { type ChoreRepository } from '../../domain/chore.repository';
import { IntervalUnit } from '../../domain/enums/interval-unit.enum';

import { UpdateChoreUseCase } from './update-chore.use-case';

describe('UpdateChoreUseCase', () => {
  let useCase: UpdateChoreUseCase;
  let repo: jest.Mocked<ChoreRepository>;

  const userId = 'user-1';

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      softDelete: jest.fn(),
    } as jest.Mocked<ChoreRepository>;
    useCase = new UpdateChoreUseCase(repo);
  });

  it('updates name, notes and category', async () => {
    const chore = buildChore({ userId, name: 'Old', notes: null, category: null });
    repo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId, {
      name: 'New name',
      notes: 'Some notes',
      category: 'Mascotas',
    });

    expect(result.name).toBe('New name');
    expect(result.notes).toBe('Some notes');
    expect(result.category).toBe('Mascotas');
  });

  it('updates intervalValue and intervalUnit WITHOUT recomputing nextDueDate', async () => {
    // Decision firmada: changing the cadence does not move nextDueDate.
    const chore = buildChore({
      userId,
      intervalValue: 1,
      intervalUnit: IntervalUnit.DAYS,
      nextDueDate: '2026-05-01',
    });
    repo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId, {
      intervalValue: 3,
      intervalUnit: IntervalUnit.MONTHS,
    });

    expect(result.intervalValue).toBe(3);
    expect(result.intervalUnit).toBe(IntervalUnit.MONTHS);
    expect(result.nextDueDate).toBe('2026-05-01');
  });

  it('overrides nextDueDate when explicitly provided', async () => {
    const chore = buildChore({ userId, nextDueDate: '2026-04-15' });
    repo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId, { nextDueDate: '2026-06-01' });

    expect(result.nextDueDate).toBe('2026-06-01');
  });

  it('throws CHORE_NOT_FOUND when the id is unknown', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId, { name: 'Y' })).rejects.toThrow(DomainException);
  });

  it('hides chores owned by another user behind CHORE_NOT_FOUND', async () => {
    repo.findById.mockResolvedValue(buildChore({ userId: 'other' }));

    await expect(useCase.execute('x', userId, { name: 'Y' })).rejects.toThrow(
      'Tarea no encontrada',
    );
  });

  it('keeps untouched fields when only some are sent', async () => {
    const chore = buildChore({
      userId,
      name: 'Original',
      notes: 'Original notes',
      category: 'Limpieza',
      nextDueDate: '2026-04-30',
    });
    repo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId, { name: 'Updated' });

    expect(result.name).toBe('Updated');
    expect(result.notes).toBe('Original notes');
    expect(result.category).toBe('Limpieza');
    expect(result.nextDueDate).toBe('2026-04-30');
  });
});
