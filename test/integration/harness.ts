import { randomUUID } from 'node:crypto';

import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '../../src/common/__tests__/pino-logger.mock';
import { type Currency } from '../../src/common/enums/currency.enum';
import { CurrencyPoolService } from '../../src/modules/currency-pools/application/currency-pool.service';
import { CurrencyPoolOrmEntity } from '../../src/modules/currency-pools/infrastructure/persistence/currency-pool.orm-entity';
import { CurrencyPoolRepositoryImpl } from '../../src/modules/currency-pools/infrastructure/persistence/currency-pool.repository.impl';
import { BulkSettleByReferenceUseCase } from '../../src/modules/debts-loans/application/use-cases/bulk-settle-by-reference.use-case';
import { DeleteDebtLoanPaymentUseCase } from '../../src/modules/debts-loans/application/use-cases/delete-debt-loan-payment.use-case';
import { SettleAmountByReferenceUseCase } from '../../src/modules/debts-loans/application/use-cases/settle-amount-by-reference.use-case';
import { SettleDebtLoanUseCase } from '../../src/modules/debts-loans/application/use-cases/settle-debt-loan.use-case';
import { UpdateDebtLoanPaymentUseCase } from '../../src/modules/debts-loans/application/use-cases/update-debt-loan-payment.use-case';
import { DebtLoanOrmEntity } from '../../src/modules/debts-loans/infrastructure/persistence/debt-loan.orm-entity';
import { DebtLoanRepositoryImpl } from '../../src/modules/debts-loans/infrastructure/persistence/debt-loan.repository.impl';
import { DebtLoanPaymentOrmEntity } from '../../src/modules/debts-loans/infrastructure/persistence/debt-loan-payment.orm-entity';
import { DebtLoanPaymentRepositoryImpl } from '../../src/modules/debts-loans/infrastructure/persistence/debt-loan-payment.repository.impl';

import { TestDataSource } from './data-source';

/**
 * Tables this suite writes to, in an order safe to truncate.
 * `debt_loan_payments` has an FK to `debts_loans`, so CASCADE covers it, but
 * listing both keeps the intent readable.
 */
const TABLES = ['debt_loan_payments', 'debts_loans', 'currency_pools'];

/**
 * Connect once and bring the schema up to date. Safe to call repeatedly —
 * TypeORM skips migrations that already ran.
 */
export async function initTestDatabase(): Promise<void> {
  if (!TestDataSource.isInitialized) {
    await TestDataSource.initialize();
  }
  await TestDataSource.runMigrations();
}

export async function closeTestDatabase(): Promise<void> {
  if (TestDataSource.isInitialized) {
    await TestDataSource.destroy();
  }
}

/** Wipe the tables this suite owns. Call between cases, not between files. */
export async function truncateTables(): Promise<void> {
  await TestDataSource.query(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`);
}

/**
 * The real use cases, wired to the real repositories against the real
 * database. No Nest DI — the classes are plain constructors, and building
 * them by hand keeps the wiring visible instead of hidden behind a module.
 *
 * The Pino logger is the only mock: it writes noise, not behaviour.
 */
export function buildUseCases() {
  const logger = buildMockPinoLogger() as unknown as PinoLogger;

  const debtRepo = new DebtLoanRepositoryImpl(TestDataSource.getRepository(DebtLoanOrmEntity));
  const paymentRepo = new DebtLoanPaymentRepositoryImpl(
    TestDataSource.getRepository(DebtLoanPaymentOrmEntity),
  );
  const poolRepo = new CurrencyPoolRepositoryImpl(
    TestDataSource.getRepository(CurrencyPoolOrmEntity),
  );
  const poolService = new CurrencyPoolService(poolRepo, logger);

  return {
    debtRepo,
    paymentRepo,
    poolService,
    settle: new SettleDebtLoanUseCase(debtRepo, paymentRepo, poolService, TestDataSource, logger),
    settleAmount: new SettleAmountByReferenceUseCase(
      debtRepo,
      paymentRepo,
      poolService,
      TestDataSource,
      logger,
    ),
    bulkSettle: new BulkSettleByReferenceUseCase(
      debtRepo,
      paymentRepo,
      poolService,
      TestDataSource,
      logger,
    ),
    updatePayment: new UpdateDebtLoanPaymentUseCase(
      debtRepo,
      paymentRepo,
      poolService,
      TestDataSource,
      logger,
    ),
    deletePayment: new DeleteDebtLoanPaymentUseCase(
      debtRepo,
      paymentRepo,
      poolService,
      TestDataSource,
      logger,
    ),
  };
}

/**
 * Write a pool balance directly.
 *
 * Deliberately NOT via `CurrencyPoolService.applyDelta`: that method always
 * asks for `pessimistic_write`, so calling it outside a transaction throws
 * `PessimisticLockTransactionRequiredError`. Seeding is setup, not the
 * behaviour under test, so it writes the row straight.
 */
export async function seedPoolBalance(
  userId: string,
  currency: Currency,
  balance: number,
): Promise<void> {
  await TestDataSource.getRepository(CurrencyPoolOrmEntity).save({
    id: randomUUID(),
    userId,
    currency,
    balance,
  });
}

/** Read a pool balance straight from the DB, or 0 when the row was never created. */
export async function readPoolBalance(userId: string, currency: string): Promise<number> {
  const rows = await TestDataSource.query<Array<{ balance: string }>>(
    `SELECT balance FROM currency_pools WHERE "userId" = $1 AND currency = $2`,
    [userId, currency],
  );
  return rows.length === 0 ? 0 : Number(rows[0].balance);
}

/**
 * Split the outcomes of a concurrent pair into what resolved and what threw.
 * The lock proofs all take the same shape: fire two operations at once, then
 * assert on which survived and what the database ended up holding.
 */
export function partitionSettled<T>(results: PromiseSettledResult<T>[]): {
  fulfilled: T[];
  rejected: unknown[];
} {
  return {
    fulfilled: results
      .filter((r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled')
      .map((r) => r.value),
    // `PromiseRejectedResult.reason` is typed `any`; narrowing the filter and
    // annotating the map keeps it out of the caller's types.
    rejected: results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r): unknown => r.reason),
  };
}
