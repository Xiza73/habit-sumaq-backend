import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { type DomainException } from '@common/exceptions/domain.exception';

import { buildChore } from '../../domain/__tests__/chore.factory';
import { buildChoreLog } from '../../domain/__tests__/chore-log.factory';
import { type ChoreRepository } from '../../domain/chore.repository';
import { type ChoreLogRepository } from '../../domain/chore-log.repository';
import { IntervalUnit } from '../../domain/enums/interval-unit.enum';

import { RevertLastChoreDoneUseCase } from './revert-last-chore-done.use-case';

describe('RevertLastChoreDoneUseCase', () => {
  let useCase: RevertLastChoreDoneUseCase;
  let choreRepo: jest.Mocked<ChoreRepository>;
  let logRepo: jest.Mocked<ChoreLogRepository>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  const userId = 'user-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    choreRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      softDelete: jest.fn(),
    };

    logRepo = {
      findByChoreId: jest.fn(),
      countByChoreId: jest.fn(),
      findLatestByChoreId: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };

    mockLogger = buildMockPinoLogger();
    useCase = new RevertLastChoreDoneUseCase(
      choreRepo,
      logRepo,
      dataSource as unknown as DataSource,
      mockLogger as unknown as PinoLogger,
    );
  });

  it('reconstructs lastDoneDate and nextDueDate from the previous log', async () => {
    const chore = buildChore({
      userId,
      intervalValue: 2,
      intervalUnit: IntervalUnit.WEEKS,
      startDate: '2026-04-01',
      lastDoneDate: '2026-04-15',
      nextDueDate: '2026-04-29',
    });
    const latest = buildChoreLog({ id: 'log-latest', choreId: chore.id, doneAt: '2026-04-15' });
    const previous = buildChoreLog({ id: 'log-prev', choreId: chore.id, doneAt: '2026-04-01' });

    choreRepo.findById.mockResolvedValue(chore);
    // First lookup (outside tx) returns the log to revert; the lookup inside
    // the tx (after the soft-delete) returns the now-latest previous log.
    logRepo.findLatestByChoreId.mockResolvedValueOnce(latest).mockResolvedValueOnce(previous);

    const result = await useCase.execute(chore.id, userId);

    expect(logRepo.softDelete).toHaveBeenCalledWith('log-latest', FAKE_MGR);
    expect(result.lastDoneDate).toBe('2026-04-01');
    // 2 weeks from 2026-04-01 = 2026-04-15
    expect(result.nextDueDate).toBe('2026-04-15');
    expect(choreRepo.save).toHaveBeenCalledWith(chore, FAKE_MGR);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('resets to the never-done state when the reverted log was the only one', async () => {
    const chore = buildChore({
      userId,
      intervalValue: 3,
      intervalUnit: IntervalUnit.DAYS,
      startDate: '2026-04-01',
      lastDoneDate: '2026-04-15',
      nextDueDate: '2026-04-18',
    });
    const latest = buildChoreLog({ id: 'log-only', choreId: chore.id, doneAt: '2026-04-15' });

    choreRepo.findById.mockResolvedValue(chore);
    logRepo.findLatestByChoreId.mockResolvedValueOnce(latest).mockResolvedValueOnce(null);

    const result = await useCase.execute(chore.id, userId);

    expect(logRepo.softDelete).toHaveBeenCalledWith('log-only', FAKE_MGR);
    expect(result.lastDoneDate).toBeNull();
    expect(result.nextDueDate).toBe('2026-04-01');
  });

  it('unwinds two dones across two consecutive reverts', async () => {
    // Chore done twice: first on 2026-04-01, then on 2026-04-15.
    const chore = buildChore({
      userId,
      intervalValue: 2,
      intervalUnit: IntervalUnit.WEEKS,
      startDate: '2026-03-01',
      lastDoneDate: '2026-04-15',
      nextDueDate: '2026-04-29',
    });
    const logA = buildChoreLog({ id: 'log-a', choreId: chore.id, doneAt: '2026-04-01' });
    const logB = buildChoreLog({ id: 'log-b', choreId: chore.id, doneAt: '2026-04-15' });

    choreRepo.findById.mockResolvedValue(chore);

    // Revert 1: latest=B, previous=A → back to the 2026-04-01 completion.
    logRepo.findLatestByChoreId.mockResolvedValueOnce(logB).mockResolvedValueOnce(logA);
    const afterFirst = await useCase.execute(chore.id, userId);
    expect(afterFirst.lastDoneDate).toBe('2026-04-01');
    expect(afterFirst.nextDueDate).toBe('2026-04-15');

    // Revert 2: latest=A, previous=none → never-done state.
    logRepo.findLatestByChoreId.mockResolvedValueOnce(logA).mockResolvedValueOnce(null);
    const afterSecond = await useCase.execute(chore.id, userId);
    expect(afterSecond.lastDoneDate).toBeNull();
    expect(afterSecond.nextDueDate).toBe('2026-03-01');

    expect(logRepo.softDelete).toHaveBeenNthCalledWith(1, 'log-b', FAKE_MGR);
    expect(logRepo.softDelete).toHaveBeenNthCalledWith(2, 'log-a', FAKE_MGR);
  });

  it('throws CHORE_NO_LOGS_TO_REVERT when the chore has no logs', async () => {
    const chore = buildChore({ userId });
    choreRepo.findById.mockResolvedValue(chore);
    logRepo.findLatestByChoreId.mockResolvedValueOnce(null);

    await expect(useCase.execute(chore.id, userId)).rejects.toMatchObject({
      code: 'CHORE_NO_LOGS_TO_REVERT',
    } satisfies Partial<DomainException>);

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(logRepo.softDelete).not.toHaveBeenCalled();
    expect(choreRepo.save).not.toHaveBeenCalled();
  });

  it('throws CHORE_NOT_FOUND when the id is unknown', async () => {
    choreRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId)).rejects.toMatchObject({
      code: 'CHORE_NOT_FOUND',
    } satisfies Partial<DomainException>);
    expect(logRepo.findLatestByChoreId).not.toHaveBeenCalled();
  });

  it('hides chores owned by another user behind CHORE_NOT_FOUND', async () => {
    choreRepo.findById.mockResolvedValue(buildChore({ userId: 'other' }));

    await expect(useCase.execute('x', userId)).rejects.toThrow('Tarea no encontrada');
    expect(logRepo.findLatestByChoreId).not.toHaveBeenCalled();
  });

  it('logs the revert event with chore + reverted log identifiers', async () => {
    const chore = buildChore({ userId });
    const latest = buildChoreLog({ id: 'log-x', choreId: chore.id, doneAt: '2026-04-15' });
    choreRepo.findById.mockResolvedValue(chore);
    logRepo.findLatestByChoreId.mockResolvedValueOnce(latest).mockResolvedValueOnce(null);

    await useCase.execute(chore.id, userId);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'chore.revert_last_done',
        userId,
        choreId: chore.id,
        revertedLogId: 'log-x',
      }),
      'chore.revert_last_done',
    );
  });
});
