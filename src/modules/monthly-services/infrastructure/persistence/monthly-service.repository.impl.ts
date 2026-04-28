import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { MonthlyServiceOrmEntity } from './monthly-service.orm-entity';

@Injectable()
export class MonthlyServiceRepositoryImpl extends MonthlyServiceRepository {
  constructor(
    @InjectRepository(MonthlyServiceOrmEntity)
    private readonly repo: Repository<MonthlyServiceOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string, includeArchived = false): Promise<MonthlyService[]> {
    const where = includeArchived ? { userId } : { userId, isActive: true };
    const rows = await this.repo.find({
      where,
      order: { isActive: 'DESC', name: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<MonthlyService | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findActiveByUserIdAndName(userId: string, name: string): Promise<MonthlyService | null> {
    const row = await this.repo.findOne({ where: { userId, name, isActive: true } });
    return row ? this.toDomain(row) : null;
  }

  async save(service: MonthlyService): Promise<MonthlyService> {
    const entity = this.repo.create({
      id: service.id,
      userId: service.userId,
      name: service.name,
      defaultAccountId: service.defaultAccountId,
      categoryId: service.categoryId,
      currency: service.currency,
      frequencyMonths: service.frequencyMonths,
      estimatedAmount: service.estimatedAmount,
      dueDay: service.dueDay,
      startPeriod: service.startPeriod,
      lastPaidPeriod: service.lastPaidPeriod,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      deletedAt: service.deletedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  private toDomain(entity: MonthlyServiceOrmEntity): MonthlyService {
    return new MonthlyService(
      entity.id,
      entity.userId,
      entity.name,
      entity.defaultAccountId,
      entity.categoryId,
      entity.currency,
      entity.frequencyMonths,
      entity.estimatedAmount,
      entity.dueDay,
      entity.startPeriod,
      entity.lastPaidPeriod,
      entity.isActive,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
