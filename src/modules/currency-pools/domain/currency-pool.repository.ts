import { type EntityManager } from 'typeorm';

import { type Currency } from '@modules/accounts/domain/enums/currency.enum';

import { type CurrencyPool } from './currency-pool.entity';

/**
 * Abstract repo for `CurrencyPool`. The pool is internal-only — there is
 * no HTTP surface — so this repo is consumed exclusively by
 * `CurrencyPoolService`.
 *
 * Both methods accept an optional `manager` (TypeORM `EntityManager`) so
 * the service can pass through the transactional manager from
 * `repo.manager.transaction(...)` callers (e.g. `AddBudgetMovementUseCase`
 * after Phase A4). When omitted, the default manager (`ormRepo.manager`)
 * is used.
 *
 * `findByUserIdAndCurrency` exposes the `pessimistic_write` lock as an
 * optional option (rather than baking it in) so non-mutating callers —
 * none exist today, but future read paths might — can skip the lock cost.
 */
export abstract class CurrencyPoolRepository {
  abstract findByUserIdAndCurrency(
    userId: string,
    currency: Currency,
    options?: { lock?: 'pessimistic_write'; manager?: EntityManager },
  ): Promise<CurrencyPool | null>;

  abstract save(pool: CurrencyPool, manager?: EntityManager): Promise<CurrencyPool>;
}
