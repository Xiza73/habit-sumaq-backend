import { DomainException } from '@common/exceptions/domain.exception';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { type MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

import { AddMonthlyServiceParticipantUseCase } from './add-monthly-service-participant.use-case';

function buildExistingParticipant(
  overrides: Partial<{
    reference: string;
    normalizedReference: string;
    defaultAmount: number;
  }> = {},
): MonthlyServiceParticipant {
  const now = new Date('2026-07-27T12:00:00.000Z');
  return new MonthlyServiceParticipant({
    id: 'existing-participant',
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

describe('AddMonthlyServiceParticipantUseCase', () => {
  let useCase: AddMonthlyServiceParticipantUseCase;
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

    useCase = new AddMonthlyServiceParticipantUseCase(serviceRepo, participantRepo);
  });

  it('adds a participant to an unshared service (service becomes shared)', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);

    const result = await useCase.execute('service-1', userId, {
      reference: 'Ana',
      defaultAmount: 100,
    });

    expect(result.reference).toBe('Ana');
    expect(result.normalizedReference).toBe('ana');
    expect(result.defaultAmount).toBe(100);
    expect(participantRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects a duplicate normalized reference', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByNormalizedReference.mockResolvedValue(buildExistingParticipant());

    await expect(
      useCase.execute('service-1', userId, { reference: 'ana', defaultAmount: 50 }),
    ).rejects.toThrow(DomainException);
    expect(participantRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when sum of default amounts would exceed estimatedAmount', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([
      buildExistingParticipant({
        reference: 'Ana',
        normalizedReference: 'ana',
        defaultAmount: 100,
      }),
    ]);

    await expect(
      useCase.execute('service-1', userId, { reference: 'Luis', defaultAmount: 250 }),
    ).rejects.toThrow(DomainException);
    expect(participantRepo.save).not.toHaveBeenCalled();
  });

  it('allows adding when sum stays within estimatedAmount (triangulation)', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);
    participantRepo.findByServiceId.mockResolvedValue([
      buildExistingParticipant({
        reference: 'Ana',
        normalizedReference: 'ana',
        defaultAmount: 100,
      }),
    ]);

    const result = await useCase.execute('service-1', userId, {
      reference: 'Luis',
      defaultAmount: 150,
    });

    expect(result.defaultAmount).toBe(150);
  });

  it('rejects a non-positive default amount', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: 300 });
    serviceRepo.findById.mockResolvedValue(service);

    await expect(
      useCase.execute('service-1', userId, { reference: 'Ana', defaultAmount: 0 }),
    ).rejects.toThrow(DomainException);
    expect(participantRepo.save).not.toHaveBeenCalled();
  });

  it('allows adding without an estimatedAmount cap when service has none set', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId, estimatedAmount: null });
    serviceRepo.findById.mockResolvedValue(service);

    const result = await useCase.execute('service-1', userId, {
      reference: 'Ana',
      defaultAmount: 999999,
    });

    expect(result.defaultAmount).toBe(999999);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND for unknown service', async () => {
    serviceRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('missing', userId, { reference: 'Ana', defaultAmount: 100 }),
    ).rejects.toThrow(DomainException);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when service belongs to another user', async () => {
    const service = buildMonthlyService({ id: 'service-1', userId: 'other-user' });
    serviceRepo.findById.mockResolvedValue(service);

    await expect(
      useCase.execute('service-1', userId, { reference: 'Ana', defaultAmount: 100 }),
    ).rejects.toThrow(DomainException);
  });
});
