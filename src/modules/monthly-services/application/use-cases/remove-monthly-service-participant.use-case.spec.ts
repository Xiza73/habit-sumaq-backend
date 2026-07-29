import { DomainException } from '@common/exceptions/domain.exception';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { type MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

import { RemoveMonthlyServiceParticipantUseCase } from './remove-monthly-service-participant.use-case';

function buildParticipant(
  overrides: Partial<{ id: string; reference: string; normalizedReference: string }> = {},
): MonthlyServiceParticipant {
  const now = new Date('2026-07-27T12:00:00.000Z');
  return new MonthlyServiceParticipant({
    id: overrides.id ?? 'participant-1',
    monthlyServiceId: 'service-1',
    userId: 'user-1',
    reference: overrides.reference ?? 'Ana',
    normalizedReference: overrides.normalizedReference ?? 'ana',
    defaultAmount: 100,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('RemoveMonthlyServiceParticipantUseCase', () => {
  let useCase: RemoveMonthlyServiceParticipantUseCase;
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
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new RemoveMonthlyServiceParticipantUseCase(serviceRepo, participantRepo);
  });

  it('removes one participant, leaving the others configured', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId });
    const ana = buildParticipant({ id: 'p1', reference: 'Ana', normalizedReference: 'ana' });
    const luis = buildParticipant({ id: 'p2', reference: 'Luis', normalizedReference: 'luis' });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([ana, luis]);

    await useCase.execute('service-1', 'p2', userId);

    expect(participantRepo.softDelete).toHaveBeenCalledWith('p2');
  });

  it('removing the last participant still succeeds (service reverts to unshared)', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId });
    const ana = buildParticipant({ id: 'p1' });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([ana]);

    await useCase.execute('service-1', 'p1', userId);

    expect(participantRepo.softDelete).toHaveBeenCalledWith('p1');
  });

  it('throws MSP_PARTICIPANT_NOT_FOUND for unknown participant', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([]);

    await expect(useCase.execute('service-1', 'missing', userId)).rejects.toThrow(DomainException);
    expect(participantRepo.softDelete).not.toHaveBeenCalled();
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when service belongs to another user', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId: 'other-user' });
    serviceRepo.findById.mockResolvedValue(service);

    await expect(useCase.execute('service-1', 'p1', userId)).rejects.toThrow(DomainException);
  });
});
