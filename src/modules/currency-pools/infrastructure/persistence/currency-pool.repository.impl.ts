import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type EntityManager, IsNull, Repository } from 'typeorm';

import { type Currency } from '@common/enums/currency.enum';

import { CurrencyPool } from '../../domain/currency-pool.entity';
import { CurrencyPoolRepository } from '../../domain/currency-pool.repository';

import { CurrencyPoolOrmEntity } from './currency-pool.orm-entity';

@Injectable()
export class CurrencyPoolRepositoryImpl extends CurrencyPoolRepository {
  constructor(
    @InjectRepository(CurrencyPoolOrmEntity)
    private readonly ormRepo: Repository<CurrencyPoolOrmEntity>,
  ) {
    super();
  }

  async findByUserIdAndCurrency(
    userId: string,
    currency: Currency,
    options: { lock?: 'pessimistic_write'; manager?: EntityManager } = {},
  ): Promise<CurrencyPool | null> {
    const manager = options.manager ?? this.ormRepo.manager;
    const row = await manager.findOne(CurrencyPoolOrmEntity, {
      where: { userId, currency, deletedAt: IsNull() },
      lock: options.lock ? { mode: options.lock } : undefined,
    });
    return row ? this.toDomain(row) : null;
  }

  async save(pool: CurrencyPool, manager?: EntityManager): Promise<CurrencyPool> {
    const m = manager ?? this.ormRepo.manager;
    // `m.save(EntityClass, plainObject)` upserts on PK if present, inserts
    // otherwise. Same pattern as chore.repository.impl.ts.
    const saved = await m.save(CurrencyPoolOrmEntity, {
      id: pool.id,
      userId: pool.userId,
      currency: pool.currency,
      balance: pool.balance,
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt,
      deletedAt: pool.deletedAt,
    });
    return this.toDomain(saved);
  }

  private toDomain(orm: CurrencyPoolOrmEntity): CurrencyPool {
    return new CurrencyPool(
      orm.id,
      orm.userId,
      orm.currency,
      // NUMERIC comes back as string from pg; coerce defensively.
      typeof orm.balance === 'string' ? Number(orm.balance) : orm.balance,
      orm.createdAt,
      orm.updatedAt,
      orm.deletedAt,
    );
  }
}
