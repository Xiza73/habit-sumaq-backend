import { type DataSource, type EntityManager, QueryFailedError } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { type MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

import { ReplaceMonthlyServiceParticipantsUseCase } from './replace-monthly-service-participants.use-case';

function buildExistingParticipant(
  overrides: Partial<{
    id: string;
    reference: string;
    normalizedReference: string;
    defaultAmount: number;
  }> = {},
): MonthlyServiceParticipant {
  const now = new Date('2026-07-27T12:00:00.000Z');
  return new MonthlyServiceParticipant({
    id: overrides.id ?? 'existing-participant',
    monthlyServiceId: 'service-1',
    userId: 'user-1',
    reference: overrides.reference ?? 'Ana',
    normalizedReference: overrides.normalizedReference ?? 'ana',
    defaultAmount: overrides.defaultAmount ?? 100,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('ReplaceMonthlyServiceParticipantsUseCase', () => {
  let useCase: ReplaceMonthlyServiceParticipantsUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let participantRepo: jest.Mocked<MonthlyServiceParticipantRepository>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;

  const userId = 'user-1';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    participantRepo = {
      findByServiceId: jest.fn().mockResolvedValue([]),
      findByNormalizedReference: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };

    useCase = new ReplaceMonthlyServiceParticipantsUseCase(
      serviceRepo,
      participantRepo,
      dataSource as unknown as DataSource,
    );
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND for unknown service', async () => {
    serviceRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', userId, { participants: [] })).rejects.toThrow(
      DomainException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when service belongs to another user', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId: 'other-user' });
    serviceRepo.findById.mockResolvedValue(service);

    await expect(useCase.execute('service-1', userId, { participants: [] })).rejects.toThrow(
      DomainException,
    );
  });

  it('rejects duplicate normalized references within the batch', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);

    await expect(
      useCase.execute('service-1', userId, {
        participants: [
          { reference: 'Ana', defaultAmount: 100 },
          { reference: 'ana', defaultAmount: 50 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'MSP_PARTICIPANT_DUPLICATE_REFERENCE' });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a non-positive amount in the batch', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);

    await expect(
      useCase.execute('service-1', userId, {
        participants: [{ reference: 'Ana', defaultAmount: 0 }],
      }),
    ).rejects.toMatchObject({ code: 'MSP_PARTICIPANT_AMOUNT_NOT_POSITIVE' });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects when the batch sum exceeds estimatedAmount', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);

    await expect(
      useCase.execute('service-1', userId, {
        participants: [
          { reference: 'Ana', defaultAmount: 200 },
          { reference: 'Luis', defaultAmount: 150 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED' });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('allows the batch sum to exactly equal estimatedAmount (integer cents, no float drift)', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 0.3 });
    serviceRepo.findById.mockResolvedValue(service);

    const result = await useCase.execute('service-1', userId, {
      participants: [
        { reference: 'Ana', defaultAmount: 0.1 },
        { reference: 'Luis', defaultAmount: 0.2 },
      ],
    });

    expect(result).toHaveLength(2);
  });

  it('allows any sum when estimatedAmount is null', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: null });
    serviceRepo.findById.mockResolvedValue(service);

    const result = await useCase.execute('service-1', userId, {
      participants: [{ reference: 'Ana', defaultAmount: 999999 }],
    });

    expect(result).toHaveLength(1);
  });

  it('replaces the full list in one call: updates matches, inserts new, soft-deletes missing', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 500 });
    serviceRepo.findById.mockResolvedValue(service);

    const ana = buildExistingParticipant({
      id: 'p-ana',
      reference: 'Ana',
      normalizedReference: 'ana',
      defaultAmount: 100,
    });
    const luis = buildExistingParticipant({
      id: 'p-luis',
      reference: 'Luis',
      normalizedReference: 'luis',
      defaultAmount: 80,
    });
    participantRepo.findByServiceId.mockResolvedValue([ana, luis]);

    const result = await useCase.execute('service-1', userId, {
      participants: [
        { reference: 'Ana', defaultAmount: 120 }, // update match
        { reference: 'Marta', defaultAmount: 60 }, // new insert
        // Luis omitted -> soft-deleted
      ],
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(participantRepo.softDelete).toHaveBeenCalledWith('p-luis', FAKE_MGR);
    expect(participantRepo.softDelete).toHaveBeenCalledTimes(1);

    // Update: same id reused, amount + raw reference updated.
    expect(participantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-ana', reference: 'Ana', defaultAmount: 120 }),
      FAKE_MGR,
    );
    // Insert: new participant persisted with a fresh id.
    expect(participantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'Marta', defaultAmount: 60 }),
      FAKE_MGR,
    );

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.reference).sort()).toEqual(['Ana', 'Marta']);
  });

  it('replacing with an empty array soft-deletes every active participant', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);
    const ana = buildExistingParticipant({ id: 'p-ana' });
    participantRepo.findByServiceId.mockResolvedValue([ana]);

    const result = await useCase.execute('service-1', userId, { participants: [] });

    expect(participantRepo.softDelete).toHaveBeenCalledWith('p-ana', FAKE_MGR);
    expect(participantRepo.save).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('updates the raw reference casing even when the normalized reference matches', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);
    const ana = buildExistingParticipant({
      id: 'p-ana',
      reference: 'ana',
      normalizedReference: 'ana',
      defaultAmount: 100,
    });
    participantRepo.findByServiceId.mockResolvedValue([ana]);

    await useCase.execute('service-1', userId, {
      participants: [{ reference: 'Ana', defaultAmount: 100 }],
    });

    expect(participantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-ana', reference: 'Ana' }),
      FAKE_MGR,
    );
  });

  it('translates a unique-index race (23505) into MSP_PARTICIPANT_DUPLICATE_REFERENCE', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([]);
    const driverError = Object.assign(new Error('duplicate key value'), { code: '23505' });
    const queryFailed = new QueryFailedError('INSERT ...', [], driverError);
    participantRepo.save.mockRejectedValue(queryFailed);

    await expect(
      useCase.execute('service-1', userId, {
        participants: [{ reference: 'Ana', defaultAmount: 100 }],
      }),
    ).rejects.toMatchObject({ code: 'MSP_PARTICIPANT_DUPLICATE_REFERENCE' });
  });

  it('re-throws non-unique-violation errors untouched', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([]);
    const unexpected = new Error('connection reset');
    participantRepo.save.mockRejectedValue(unexpected);

    await expect(
      useCase.execute('service-1', userId, {
        participants: [{ reference: 'Ana', defaultAmount: 100 }],
      }),
    ).rejects.toBe(unexpected);
  });
});
