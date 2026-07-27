import { DomainException } from '@common/exceptions/domain.exception';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { type MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

import { UpdateMonthlyServiceParticipantUseCase } from './update-monthly-service-participant.use-case';

function buildParticipant(
  overrides: Partial<{
    id: string;
    monthlyServiceId: string;
    reference: string;
    normalizedReference: string;
    defaultAmount: number;
  }> = {},
): MonthlyServiceParticipant {
  const now = new Date('2026-07-27T12:00:00.000Z');
  return new MonthlyServiceParticipant({
    id: overrides.id ?? 'participant-1',
    monthlyServiceId: overrides.monthlyServiceId ?? 'service-1',
    userId: 'user-1',
    reference: overrides.reference ?? 'Ana',
    normalizedReference: overrides.normalizedReference ?? 'ana',
    defaultAmount: overrides.defaultAmount ?? 100,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('UpdateMonthlyServiceParticipantUseCase', () => {
  let useCase: UpdateMonthlyServiceParticipantUseCase;
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
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      softDelete: jest.fn(),
    };

    useCase = new UpdateMonthlyServiceParticipantUseCase(serviceRepo, participantRepo);
  });

  it('updates the default amount when sum still fits under estimatedAmount', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    const participant = buildParticipant({ id: 'p1', defaultAmount: 100 });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([participant]);

    const result = await useCase.execute('service-1', 'p1', userId, { defaultAmount: 120 });

    expect(result.defaultAmount).toBe(120);
    expect(participantRepo.save).toHaveBeenCalledTimes(1);
  });

  it('re-validates sum against estimatedAmount excluding the participant being edited', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    const ana = buildParticipant({ id: 'p1', reference: 'Ana', defaultAmount: 100 });
    const luis = buildParticipant({
      id: 'p2',
      reference: 'Luis',
      normalizedReference: 'luis',
      defaultAmount: 150,
    });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([ana, luis]);

    // Ana(100) + Luis(150) = 250 currently. Raising Ana to 200 => 200+150=350 > 300.
    await expect(
      useCase.execute('service-1', 'p1', userId, { defaultAmount: 200 }),
    ).rejects.toThrow(DomainException);
    expect(participantRepo.save).not.toHaveBeenCalled();
  });

  it('allows raising the amount when the new sum still fits (triangulation)', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    const ana = buildParticipant({ id: 'p1', reference: 'Ana', defaultAmount: 100 });
    const luis = buildParticipant({
      id: 'p2',
      reference: 'Luis',
      normalizedReference: 'luis',
      defaultAmount: 150,
    });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([ana, luis]);

    // Ana(100)->140 + Luis(150) = 290 <= 300.
    const result = await useCase.execute('service-1', 'p1', userId, { defaultAmount: 140 });

    expect(result.defaultAmount).toBe(140);
  });

  it('rejects a non-positive amount', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    const participant = buildParticipant({ id: 'p1', defaultAmount: 100 });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([participant]);

    await expect(useCase.execute('service-1', 'p1', userId, { defaultAmount: -5 })).rejects.toThrow(
      DomainException,
    );
    expect(participantRepo.save).not.toHaveBeenCalled();
  });

  it('throws MSP_PARTICIPANT_NOT_FOUND for unknown participant', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([]);

    await expect(
      useCase.execute('service-1', 'missing', userId, { defaultAmount: 50 }),
    ).rejects.toThrow(DomainException);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when service belongs to another user', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId: 'other-user' });
    serviceRepo.findById.mockResolvedValue(service);

    await expect(useCase.execute('service-1', 'p1', userId, { defaultAmount: 50 })).rejects.toThrow(
      DomainException,
    );
  });
});
