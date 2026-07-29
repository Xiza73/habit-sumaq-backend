import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type EntityManager, IsNull, Repository } from 'typeorm';

import { normalizeReference } from '@common/text/normalize-reference';

import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';
import { MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

import { MonthlyServiceParticipantOrmEntity } from './monthly-service-participant.orm-entity';

@Injectable()
export class MonthlyServiceParticipantRepositoryImpl extends MonthlyServiceParticipantRepository {
  constructor(
    @InjectRepository(MonthlyServiceParticipantOrmEntity)
    private readonly repo: Repository<MonthlyServiceParticipantOrmEntity>,
  ) {
    super();
  }

  async findByServiceId(monthlyServiceId: string): Promise<MonthlyServiceParticipant[]> {
    const rows = await this.repo.find({
      where: { monthlyServiceId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByNormalizedReference(
    monthlyServiceId: string,
    normalizedReference: string,
  ): Promise<MonthlyServiceParticipant | null> {
    const row = await this.repo.findOne({
      where: { monthlyServiceId, normalizedReference, deletedAt: IsNull() },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(
    participant: MonthlyServiceParticipant,
    manager?: EntityManager,
  ): Promise<MonthlyServiceParticipant> {
    const data = {
      id: participant.id,
      monthlyServiceId: participant.monthlyServiceId,
      userId: participant.userId,
      reference: participant.reference,
      // Always re-derived from `reference` on write — never trusts a
      // caller-supplied value, so it can't drift from the app-side
      // normalization rule (`common/text/normalize-reference.ts`).
      normalizedReference: normalizeReference(participant.reference),
      defaultAmount: participant.defaultAmount,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
      deletedAt: participant.deletedAt,
    };
    const saved = manager
      ? await manager.save(MonthlyServiceParticipantOrmEntity, data)
      : await this.repo.save(this.repo.create(data));
    return this.toDomain(saved);
  }

  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    const m = manager ?? this.repo.manager;
    await m.softDelete(MonthlyServiceParticipantOrmEntity, id);
  }

  private toDomain(entity: MonthlyServiceParticipantOrmEntity): MonthlyServiceParticipant {
    return new MonthlyServiceParticipant({
      id: entity.id,
      monthlyServiceId: entity.monthlyServiceId,
      userId: entity.userId,
      reference: entity.reference,
      normalizedReference: entity.normalizedReference,
      defaultAmount:
        typeof entity.defaultAmount === 'string'
          ? Number(entity.defaultAmount)
          : entity.defaultAmount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    });
  }
}
