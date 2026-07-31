import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager, QueryFailedError } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { DomainException } from '@common/exceptions/domain.exception';
import { buildCategory } from '@modules/categories/domain/__tests__/category.factory';
import { type CategoryRepository } from '@modules/categories/domain/category.repository';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { type MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

import { CreateMonthlyServiceUseCase } from './create-monthly-service.use-case';

import type { CreateMonthlyServiceDto } from '../dto/create-monthly-service.dto';

describe('CreateMonthlyServiceUseCase', () => {
  let useCase: CreateMonthlyServiceUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let categoryRepo: jest.Mocked<CategoryRepository>;
  let participantRepo: jest.Mocked<MonthlyServiceParticipantRepository>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  const userId = 'user-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;
  const baseDto: CreateMonthlyServiceDto = {
    name: 'Netflix',
    categoryId: 'cat-1',
    currency: 'PEN',
    estimatedAmount: 45,
    dueDay: 15,
    startPeriod: '2026-04',
  };

  beforeEach(() => {
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      softDelete: jest.fn(),
    };

    categoryRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn().mockResolvedValue(buildCategory({ id: 'cat-1', userId })),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    participantRepo = {
      findByServiceId: jest.fn().mockResolvedValue([]),
      findByNormalizedReference: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      softDelete: jest.fn(),
    };

    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };

    mockLogger = buildMockPinoLogger();
    useCase = new CreateMonthlyServiceUseCase(
      serviceRepo,
      categoryRepo,
      participantRepo,
      dataSource as unknown as DataSource,
      mockLogger as unknown as PinoLogger,
    );
  });

  it('creates a service with the provided startPeriod', async () => {
    const result = await useCase.execute(userId, baseDto, 'America/Lima');

    expect(result.name).toBe('Netflix');
    expect(result.startPeriod).toBe('2026-04');
    expect(result.lastPaidPeriod).toBeNull();
    expect(result.isActive).toBe(true);
    expect(result.estimatedAmount).toBe(45);
    expect(result.dueDay).toBe(15);
    expect(serviceRepo.save).toHaveBeenCalled();
  });

  it('defaults frequencyMonths to 1 (monthly) when not provided', async () => {
    const result = await useCase.execute(userId, baseDto, 'UTC');
    expect(result.frequencyMonths).toBe(1);
  });

  it('honors the requested frequencyMonths and shapes nextDuePeriod accordingly', async () => {
    // Quarterly service starting in April -> nextDuePeriod is still April
    // (it has not been paid yet); after first pay it would jump to July.
    const result = await useCase.execute(userId, { ...baseDto, frequencyMonths: 3 }, 'UTC');
    expect(result.frequencyMonths).toBe(3);
    expect(result.nextDuePeriod()).toBe('2026-04');
  });

  it('defaults startPeriod to current month when not provided', async () => {
    const dto = { ...baseDto, startPeriod: undefined };
    const result = await useCase.execute(userId, dto, 'UTC');

    // Format YYYY-MM
    expect(result.startPeriod).toMatch(/^\d{4}-\d{2}$/);
  });

  it('throws CATEGORY_NOT_FOUND when category does not exist', async () => {
    categoryRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow(DomainException);
    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow(
      'Categoría no encontrada',
    );
  });

  it('throws CATEGORY_NOT_FOUND when category is owned by another user', async () => {
    categoryRepo.findById.mockResolvedValue(buildCategory({ id: 'cat-1', userId: 'other' }));

    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow(
      'Categoría no encontrada',
    );
  });

  it('throws MONTHLY_SERVICE_NAME_TAKEN when an active service with the same name exists', async () => {
    serviceRepo.findActiveByUserIdAndName.mockResolvedValue(
      buildMonthlyService({ userId, name: 'Netflix' }),
    );

    await expect(useCase.execute(userId, baseDto, 'UTC')).rejects.toThrow(
      'Ya tienes un servicio activo con ese nombre',
    );
  });

  describe('optional participants[] at create time', () => {
    it('creates without opening a transaction when participants is omitted (no regression)', async () => {
      await useCase.execute(userId, baseDto, 'UTC');

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(serviceRepo.save).toHaveBeenCalledWith(expect.anything());
      expect(participantRepo.save).not.toHaveBeenCalled();
    });

    it('creates without opening a transaction when participants is an empty array (no regression)', async () => {
      await useCase.execute(userId, { ...baseDto, participants: [] }, 'UTC');

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(participantRepo.save).not.toHaveBeenCalled();
    });

    it('creates the service AND its participants atomically in one transaction', async () => {
      const result = await useCase.execute(
        userId,
        {
          ...baseDto,
          estimatedAmount: 300,
          participants: [
            { reference: 'Ana', defaultAmount: 100 },
            { reference: 'Luis', defaultAmount: 80 },
          ],
        },
        'UTC',
      );

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(serviceRepo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
      expect(participantRepo.save).toHaveBeenCalledTimes(2);
      expect(participantRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'Ana', defaultAmount: 100 }),
        FAKE_MGR,
      );
      expect(participantRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'Luis', defaultAmount: 80 }),
        FAKE_MGR,
      );
      expect(result.name).toBe('Netflix');
    });

    it('rejects duplicate normalized references within the create-time batch', async () => {
      await expect(
        useCase.execute(
          userId,
          {
            ...baseDto,
            participants: [
              { reference: 'Ana', defaultAmount: 100 },
              { reference: 'ana', defaultAmount: 50 },
            ],
          },
          'UTC',
        ),
      ).rejects.toMatchObject({ code: 'MSP_PARTICIPANT_DUPLICATE_REFERENCE' });
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(serviceRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a non-positive amount in the create-time batch', async () => {
      await expect(
        useCase.execute(
          userId,
          { ...baseDto, participants: [{ reference: 'Ana', defaultAmount: 0 }] },
          'UTC',
        ),
      ).rejects.toMatchObject({ code: 'MSP_PARTICIPANT_AMOUNT_NOT_POSITIVE' });
      expect(serviceRepo.save).not.toHaveBeenCalled();
    });

    it('rejects when the create-time batch sum exceeds estimatedAmount', async () => {
      await expect(
        useCase.execute(
          userId,
          {
            ...baseDto,
            estimatedAmount: 100,
            participants: [{ reference: 'Ana', defaultAmount: 150 }],
          },
          'UTC',
        ),
      ).rejects.toMatchObject({ code: 'MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED' });
      expect(serviceRepo.save).not.toHaveBeenCalled();
    });

    it('rolls back the service when a participant write fails mid-transaction', async () => {
      // The default `beforeEach` mock already invokes the callback with
      // `FAKE_MGR` and propagates whatever it throws — exactly what
      // `dataSource.transaction`'s real rollback-on-throw behavior does.
      //
      // Capture the actual EntityManager instance passed to BOTH the service
      // write and the participant write. Asserting they are the SAME instance
      // is the strongest available unit-level proof that both writes share one
      // transaction (a real rollback would then undo both). We can't assert
      // real DB rollback without integration infra — tracked separately.
      let serviceMgr: unknown;
      let participantMgr: unknown;
      serviceRepo.save.mockImplementationOnce((s, mgr) => {
        serviceMgr = mgr;
        return Promise.resolve(s);
      });
      participantRepo.save.mockImplementationOnce((_p, mgr) => {
        participantMgr = mgr;
        return Promise.reject(new Error('db exploded'));
      });

      await expect(
        useCase.execute(
          userId,
          {
            ...baseDto,
            estimatedAmount: 300,
            participants: [{ reference: 'Ana', defaultAmount: 100 }],
          },
          'UTC',
        ),
      ).rejects.toThrow('db exploded');

      // The service row was only ever written through the transactional
      // manager — never through the non-transactional path.
      expect(serviceRepo.save).toHaveBeenCalledTimes(1);
      expect(serviceRepo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);

      // Both writes received the exact same manager instance -> one shared
      // transaction. Without this, the participant failure would not roll back
      // the already-persisted service row.
      expect(serviceMgr).toBeDefined();
      expect(participantMgr).toBe(serviceMgr);
    });

    it('translates a unique-index race (23505) into MSP_PARTICIPANT_DUPLICATE_REFERENCE', async () => {
      const driverError = Object.assign(new Error('duplicate key value'), { code: '23505' });
      const queryFailed = new QueryFailedError('INSERT ...', [], driverError);
      participantRepo.save.mockRejectedValueOnce(queryFailed);

      await expect(
        useCase.execute(
          userId,
          {
            ...baseDto,
            estimatedAmount: 300,
            participants: [{ reference: 'Ana', defaultAmount: 100 }],
          },
          'UTC',
        ),
      ).rejects.toMatchObject({ code: 'MSP_PARTICIPANT_DUPLICATE_REFERENCE' });
    });
  });
});
