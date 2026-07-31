import { DomainException } from '@common/exceptions/domain.exception';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { type MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

import { ListMonthlyServiceParticipantsUseCase } from './list-monthly-service-participants.use-case';

function buildParticipant(id: string, reference: string): MonthlyServiceParticipant {
  const now = new Date('2026-07-27T12:00:00.000Z');
  return new MonthlyServiceParticipant({
    id,
    monthlyServiceId: 'service-1',
    userId: 'user-1',
    reference,
    normalizedReference: reference.toLowerCase(),
    defaultAmount: 100,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('ListMonthlyServiceParticipantsUseCase', () => {
  let useCase: ListMonthlyServiceParticipantsUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let participantRepo: jest.Mocked<MonthlyServiceParticipantRepository>;

  const userId = 'user-1';

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
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    useCase = new ListMonthlyServiceParticipantsUseCase(serviceRepo, participantRepo);
  });

  it('returns the configured participants for the service', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([
      buildParticipant('p1', 'Ana'),
      buildParticipant('p2', 'Luis'),
    ]);

    const result = await useCase.execute('service-1', userId);

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.reference)).toEqual(['Ana', 'Luis']);
  });

  it('returns an empty list for a service with no participants (triangulation)', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([]);

    const result = await useCase.execute('service-1', userId);

    expect(result).toEqual([]);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND for unknown service', async () => {
    serviceRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', userId)).rejects.toThrow(DomainException);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when service belongs to another user', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId: 'other-user' });
    serviceRepo.findById.mockResolvedValue(service);

    await expect(useCase.execute('service-1', userId)).rejects.toThrow(DomainException);
  });
});
