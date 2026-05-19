import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { UserAlertDismissal } from '../../domain/user-alert-dismissal.entity';
import { UserAlertDismissalRepository } from '../../domain/user-alert-dismissal.repository';

import { UserAlertDismissalOrmEntity } from './user-alert-dismissal.orm-entity';

@Injectable()
export class UserAlertDismissalRepositoryImpl extends UserAlertDismissalRepository {
  constructor(
    @InjectRepository(UserAlertDismissalOrmEntity)
    private readonly repo: Repository<UserAlertDismissalOrmEntity>,
  ) {
    super();
  }

  async findByUserId(userId: string): Promise<UserAlertDismissal[]> {
    const rows = await this.repo.find({ where: { userId } });
    return rows.map((r) => this.toDomain(r));
  }

  async upsert(dismissal: UserAlertDismissal): Promise<UserAlertDismissal> {
    // Hit the unique `(userId, alertId)` constraint via TypeORM's native
    // upsert — avoids a select-then-insert round-trip + plays well with
    // concurrent dismisses of the same alert from two devices.
    await this.repo.upsert(
      {
        userId: dismissal.userId,
        alertId: dismissal.alertId,
        dismissedAt: dismissal.dismissedAt,
        expiresAt: dismissal.expiresAt,
      },
      { conflictPaths: ['userId', 'alertId'] },
    );

    // Read-back so the caller gets the canonical row (id assigned by the
    // DB on insert, dismissedAt rounded to PG's `timestamptz` precision).
    const row = await this.repo.findOneOrFail({
      where: { userId: dismissal.userId, alertId: dismissal.alertId },
    });
    return this.toDomain(row);
  }

  private toDomain(orm: UserAlertDismissalOrmEntity): UserAlertDismissal {
    return new UserAlertDismissal(orm.id, orm.userId, orm.alertId, orm.dismissedAt, orm.expiresAt);
  }
}
