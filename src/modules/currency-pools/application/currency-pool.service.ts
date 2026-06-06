import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { type EntityManager } from 'typeorm';

import { type Currency } from '@modules/accounts/domain/enums/currency.enum';

import { CurrencyPool } from '../domain/currency-pool.entity';
import { CurrencyPoolRepository } from '../domain/currency-pool.repository';

/**
 * Single entry point for mutating the internal `(userId, currency)` pool
 * balance. Designed per the SDD design decision:
 *
 * - Synchronous within the caller's use case — no event bus. The caller
 *   (`AddBudgetMovementUseCase`, `PayMonthlyServiceUseCase`,
 *   `SettleDebtUseCase` real-payment, etc., from later phases) wraps its
 *   own write + this `applyDelta` call in `repo.manager.transaction()` and
 *   passes the transactional `EntityManager` here as `manager`.
 *
 * - `pessimistic_write` row lock on the pool — cheap defense against the
 *   2-tab race condition. Single-row lock, never blocks other users.
 *
 * - Auto-creates the pool row with `balance = 0` if missing for
 *   `(userId, currency)`. Backfill (A1-B.2) seeds existing users; this
 *   auto-create handles edge cases (fresh signup, currency never
 *   previously touched, single user with multiple currencies acquired
 *   over time).
 *
 * The service does NOT know about the audit / drift / `POOL_001` flow —
 * that's A1-B.2's job, in the migration backfill path. This service is
 * purely the runtime delta applier.
 */
@Injectable()
export class CurrencyPoolService {
  constructor(
    private readonly repo: CurrencyPoolRepository,
    @InjectPinoLogger(CurrencyPoolService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Apply `delta` to the user's pool for `currency`, locking and
   * (auto-creating if needed) atomically. Returns the updated pool.
   *
   * `manager` should be the transactional `EntityManager` from the
   * caller's `repo.manager.transaction(...)` callback so the lock + write
   * join that transaction. Omit only for standalone-test callers — the
   * runtime use cases ALWAYS pass it.
   */
  async applyDelta(
    userId: string,
    currency: Currency,
    delta: number,
    manager?: EntityManager,
  ): Promise<CurrencyPool> {
    let pool = await this.repo.findByUserIdAndCurrency(userId, currency, {
      lock: 'pessimistic_write',
      manager,
    });
    let created = false;
    if (!pool) {
      pool = CurrencyPool.newWithZeroBalance(userId, currency);
      created = true;
    }
    pool.applyDelta(delta);
    const saved = await this.repo.save(pool, manager);

    this.logger.info(
      {
        event: 'currency_pool.delta_applied',
        userId,
        currency,
        delta,
        balanceAfter: saved.balance,
        created,
      },
      'currency_pool.delta_applied',
    );

    return saved;
  }
}
