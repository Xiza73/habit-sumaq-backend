import { type EntityManager, type Repository } from 'typeorm';

import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';

import { MonthlyServiceParticipantOrmEntity } from './monthly-service-participant.orm-entity';
import { MonthlyServiceParticipantRepositoryImpl } from './monthly-service-participant.repository.impl';

function buildParticipant(
  overrides: Partial<{ reference: string; normalizedReference: string }> = {},
): MonthlyServiceParticipant {
  const now = new Date('2026-07-27T12:00:00.000Z');
  return new MonthlyServiceParticipant({
    id: 'participant-1',
    monthlyServiceId: 'service-1',
    userId: 'user-1',
    reference: overrides.reference ?? 'José',
    normalizedReference: overrides.normalizedReference ?? 'placeholder',
    defaultAmount: 100,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('MonthlyServiceParticipantRepositoryImpl', () => {
  let repo: MonthlyServiceParticipantRepositoryImpl;
  let ormRepo: jest.Mocked<
    Pick<
      Repository<MonthlyServiceParticipantOrmEntity>,
      'find' | 'findOne' | 'save' | 'softDelete' | 'create' | 'manager'
    >
  >;

  beforeEach(() => {
    ormRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
      softDelete: jest.fn().mockResolvedValue(undefined),
      create: jest
        .fn()
        .mockImplementation((data: Partial<MonthlyServiceParticipantOrmEntity>) => data),
      manager: { save: jest.fn() } as unknown as EntityManager,
    };

    repo = new MonthlyServiceParticipantRepositoryImpl(
      ormRepo as unknown as Repository<MonthlyServiceParticipantOrmEntity>,
    );
  });

  it('normalizes the reference before saving (accent + case insensitive)', async () => {
    const participant = buildParticipant({ reference: 'José María' });
    ormRepo.save.mockResolvedValue({
      id: participant.id,
      monthlyServiceId: participant.monthlyServiceId,
      userId: participant.userId,
      reference: 'José María',
      normalizedReference: 'jose maria',
      defaultAmount: 100,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
      deletedAt: null,
    });

    await repo.save(participant);

    expect(ormRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedReference: 'jose maria' }),
    );
  });

  it('normalizes a different reference to a different value (triangulation)', async () => {
    const participant = buildParticipant({ reference: '  Luis  ' });
    ormRepo.save.mockResolvedValue({
      id: participant.id,
      monthlyServiceId: participant.monthlyServiceId,
      userId: participant.userId,
      reference: '  Luis  ',
      normalizedReference: 'luis',
      defaultAmount: 100,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
      deletedAt: null,
    });

    await repo.save(participant);

    expect(ormRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedReference: 'luis' }),
    );
  });

  it('saves through the caller-supplied manager when provided (transaction passthrough)', async () => {
    const participant = buildParticipant({ reference: 'Ana' });
    const managerSave = jest.fn().mockResolvedValue({
      id: participant.id,
      monthlyServiceId: participant.monthlyServiceId,
      userId: participant.userId,
      reference: 'Ana',
      normalizedReference: 'ana',
      defaultAmount: 100,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
      deletedAt: null,
    });
    const manager = { save: managerSave } as unknown as EntityManager;

    await repo.save(participant, manager);

    expect(managerSave).toHaveBeenCalledWith(
      MonthlyServiceParticipantOrmEntity,
      expect.objectContaining({ normalizedReference: 'ana' }),
    );
    expect(ormRepo.save).not.toHaveBeenCalled();
  });

  it('uses the repo (not the manager) when no manager is supplied', async () => {
    const participant = buildParticipant({ reference: 'Ana' });
    ormRepo.save.mockResolvedValue({
      id: participant.id,
      monthlyServiceId: participant.monthlyServiceId,
      userId: participant.userId,
      reference: 'Ana',
      normalizedReference: 'ana',
      defaultAmount: 100,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
      deletedAt: null,
    });

    await repo.save(participant);

    expect(ormRepo.save).toHaveBeenCalledTimes(1);
  });
});
