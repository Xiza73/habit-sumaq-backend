import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ChoreLog } from '../../domain/chore-log.entity';
import { ChoreLogRepository } from '../../domain/chore-log.repository';

import { ChoreLogOrmEntity } from './chore-log.orm-entity';

@Injectable()
export class ChoreLogRepositoryImpl extends ChoreLogRepository {
  constructor(
    @InjectRepository(ChoreLogOrmEntity)
    private readonly repo: Repository<ChoreLogOrmEntity>,
  ) {
    super();
  }

  async findByChoreId(
    choreId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: ChoreLog[]; total: number }> {
    const [rows, total] = await this.repo
      .createQueryBuilder('log')
      .where('log.choreId = :choreId', { choreId })
      .orderBy('log.doneAt', 'DESC')
      .addOrderBy('log.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { data: rows.map((r) => this.toDomain(r)), total };
  }

  async countByChoreId(choreId: string): Promise<number> {
    return this.repo.count({ where: { choreId } });
  }

  async save(log: ChoreLog): Promise<ChoreLog> {
    const entity = this.repo.create({
      id: log.id,
      choreId: log.choreId,
      doneAt: log.doneAt,
      note: log.note,
      createdAt: log.createdAt,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  private toDomain(entity: ChoreLogOrmEntity): ChoreLog {
    return new ChoreLog(entity.id, entity.choreId, entity.doneAt, entity.note, entity.createdAt);
  }
}
