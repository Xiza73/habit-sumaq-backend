/**
 * The set of currencies the app supports. Moved here from
 * `@modules/accounts/domain/enums/currency.enum.ts` in Phase A2 of the
 * `accounts-to-modular-finance` v1.0.0 refactor.
 *
 * Why `@common/`: the enum is now consumed by modules that don't depend
 * on (and will outlive) the soon-to-be-deleted accounts module —
 * currency-pools, budgets, monthly-services, users settings, the new
 * debts-loans module (A3+) and the new budget-movements /
 * monthly-service-payments modules (A4+). Centralising here is the
 * cheapest way to break the `accounts` → everything cross-coupling
 * before A6 deletes the accounts module entirely.
 *
 * The enum values are stored as `varchar(3) + CHECK` in postgres
 * (`accounts.currency`, `currency_pools.currency`, etc.) — they are NOT
 * a postgres ENUM type, on purpose, to keep migrations cheap if we ever
 * add a new currency.
 */
export enum Currency {
  PEN = 'PEN',
  USD = 'USD',
  EUR = 'EUR',
}
