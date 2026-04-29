import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { DomainException } from '@common/exceptions/domain.exception';

import { buildChore } from '../../domain/__tests__/chore.factory';
import { type ChoreRepository } from '../../domain/chore.repository';
import { IntervalUnit } from '../../domain/enums/interval-unit.enum';

import { SkipChoreCycleUseCase } from './skip-chore-cycle.use-case';

describe('SkipChoreCycleUseCase', () => {
  let useCase: SkipChoreCycleUseCase;
  let repo: jest.Mocked<ChoreRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  const userId = 'user-1';

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      softDelete: jest.fn(),
    } as jest.Mocked<ChoreRepository>;

    mockLogger = buildMockPinoLogger();
    useCase = new SkipChoreCycleUseCase(repo, mockLogger as unknown as PinoLogger);
  });

  it('advances nextDueDate by one interval (weekly)', async () => {
    const chore = buildChore({
      userId,
      intervalValue: 2,
      intervalUnit: IntervalUnit.WEEKS,
      nextDueDate: '2026-04-15',
      lastDoneDate: '2026-04-01',
    });
    repo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId);

    // 2 weeks from 2026-04-15 = 2026-04-29
    expect(result.nextDueDate).toBe('2026-04-29');
    // lastDoneDate must NOT change on skip.
    expect(result.lastDoneDate).toBe('2026-04-01');
  });

  it('advances nextDueDate by one interval (monthly with day clamp)', async () => {
    const chore = buildChore({
      userId,
      intervalValue: 1,
      intervalUnit: IntervalUnit.MONTHS,
      nextDueDate: '2026-01-31',
    });
    repo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId);

    // Jan 31 + 1 month = Feb 28 (2026 non-leap).
    expect(result.nextDueDate).toBe('2026-02-28');
  });

  it('does not create a log (skip is a non-doing action)', async () => {
    // No log repo is even injected — but the test explicitly calls out the
    // contract: skip is purely a date shift on the chore.
    const chore = buildChore({ userId });
    repo.findById.mockResolvedValue(chore);

    await useCase.execute(chore.id, userId);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'chore.skipped', userId }),
      'chore.skipped',
    );
  });

  it('throws CHORE_NOT_FOUND when the id is unknown', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId)).rejects.toThrow(DomainException);
  });

  it('hides chores owned by another user behind CHORE_NOT_FOUND', async () => {
    repo.findById.mockResolvedValue(buildChore({ userId: 'other' }));

    await expect(useCase.execute('x', userId)).rejects.toThrow('Tarea no encontrada');
  });
});
