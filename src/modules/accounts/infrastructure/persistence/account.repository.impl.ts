import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';

import { Account } from '../../domain/account.entity';
import { AccountRepository } from '../../domain/account.repository';

import { AccountOrmEntity } from './account.orm-entity';

@Injectable()
export class AccountRepositoryImpl extends AccountRepository {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly repo: Repository<AccountOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string, includeArchived = false): Promise<Account[]> {
    const qb = this.repo
      .createQueryBuilder('account')
      .where('account.userId = :userId', { userId });

    if (!includeArchived) {
      qb.andWhere('account.isArchived = false');
    }

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findByUserIdAndName(userId: string, name: string): Promise<Account | null> {
    const entity = await this.repo.findOne({ where: { userId, name } });
    return entity ? this.toDomain(entity) : null;
  }

  async findById(id: string): Promise<Account | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByIds(ids: string[]): Promise<Account[]> {
    if (ids.length === 0) return [];
    const entities = await this.repo.find({ where: { id: In(ids) } });
    return entities.map((e) => this.toDomain(e));
  }

  async save(account: Account): Promise<Account> {
    const entity = this.repo.create({
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.balance,
      color: account.color,
      icon: account.icon,
      isArchived: account.isArchived,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      deletedAt: account.deletedAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  private toDomain(entity: AccountOrmEntity): Account {
    return new Account(
      entity.id,
      entity.userId,
      entity.name,
      entity.type,
      entity.currency,
      entity.balance,
      entity.color,
      entity.icon,
      entity.isArchived,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
