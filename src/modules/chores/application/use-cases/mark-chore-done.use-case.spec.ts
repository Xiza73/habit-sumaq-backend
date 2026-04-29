import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { DomainException } from '@common/exceptions/domain.exception';

import { buildChore } from '../../domain/__tests__/chore.factory';
import { type ChoreRepository } from '../../domain/chore.repository';
import { type ChoreLogRepository } from '../../domain/chore-log.repository';
import { IntervalUnit } from '../../domain/enums/interval-unit.enum';

import { MarkChoreDoneUseCase } from './mark-chore-done.use-case';

describe('MarkChoreDoneUseCase', () => {
  let useCase: MarkChoreDoneUseCase;
  let choreRepo: jest.Mocked<ChoreRepository>;
  let logRepo: jest.Mocked<ChoreLogRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  const userId = 'user-1';
  const CURRENT_DATE = '2026-04-15';

  beforeEach(() => {
    choreRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      softDelete: jest.fn(),
    } as jest.Mocked<ChoreRepository>;

    logRepo = {
      findByChoreId: jest.fn(),
      countByChoreId: jest.fn(),
      save: jest.fn().mockImplementation((l) => Promise.resolve(l)),
    } as jest.Mocked<ChoreLogRepository>;

    mockLogger = buildMockPinoLogger();
    useCase = new MarkChoreDoneUseCase(choreRepo, logRepo, mockLogger as unknown as PinoLogger);
  });

  it('uses currentDate when doneAt is omitted', async () => {
    const chore = buildChore({
      userId,
      intervalValue: 2,
      intervalUnit: IntervalUnit.WEEKS,
      nextDueDate: '2026-04-15',
    });
    choreRepo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId, {}, CURRENT_DATE);

    expect(result.log.doneAt).toBe(CURRENT_DATE);
    expect(result.chore.lastDoneDate).toBe(CURRENT_DATE);
    // 2 weeks from 2026-04-15 = 2026-04-29
    expect(result.chore.nextDueDate).toBe('2026-04-29');
  });

  it('honors explicit doneAt and persists the note', async () => {
    const chore = buildChore({
      userId,
      intervalValue: 1,
      intervalUnit: IntervalUnit.MONTHS,
      nextDueDate: '2026-04-15',
    });
    choreRepo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(
      chore.id,
      userId,
      { doneAt: '2026-04-10', note: 'Lo hice antes' },
      CURRENT_DATE,
    );

    expect(result.log.doneAt).toBe('2026-04-10');
    expect(result.log.note).toBe('Lo hice antes');
    expect(result.chore.lastDoneDate).toBe('2026-04-10');
    // 1 month from 2026-04-10 = 2026-05-10
    expect(result.chore.nextDueDate).toBe('2026-05-10');
  });

  it('advances nextDueDate by intervalValue days when unit=days', async () => {
    const chore = buildChore({
      userId,
      intervalValue: 3,
      intervalUnit: IntervalUnit.DAYS,
      nextDueDate: '2026-04-15',
    });
    choreRepo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId, {}, '2026-04-15');

    // 3 days from 2026-04-15 = 2026-04-18
    expect(result.chore.nextDueDate).toBe('2026-04-18');
  });

  it('advances nextDueDate by years and clamps Feb 29 to Feb 28 in non-leap target', async () => {
    const chore = buildChore({
      userId,
      intervalValue: 1,
      intervalUnit: IntervalUnit.YEARS,
    });
    choreRepo.findById.mockResolvedValue(chore);

    const result = await useCase.execute(chore.id, userId, { doneAt: '2024-02-29' }, CURRENT_DATE);

    // Feb 29, 2024 + 1 year = Feb 28, 2025 (non-leap).
    expect(result.chore.nextDueDate).toBe('2025-02-28');
  });

  it('throws CHORE_NOT_FOUND when the id is unknown', async () => {
    choreRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId, {}, CURRENT_DATE)).rejects.toThrow(DomainException);
    expect(logRepo.save).not.toHaveBeenCalled();
    expect(choreRepo.save).not.toHaveBeenCalled();
  });

  it('hides chores owned by another user behind CHORE_NOT_FOUND', async () => {
    choreRepo.findById.mockResolvedValue(buildChore({ userId: 'other' }));

    await expect(useCase.execute('x', userId, {}, CURRENT_DATE)).rejects.toThrow(
      'Tarea no encontrada',
    );
  });

  it('logs the event with chore + log identifiers', async () => {
    const chore = buildChore({ userId });
    choreRepo.findById.mockResolvedValue(chore);

    await useCase.execute(chore.id, userId, {}, CURRENT_DATE);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'chore.done', userId, choreId: chore.id }),
      'chore.done',
    );
  });
});
