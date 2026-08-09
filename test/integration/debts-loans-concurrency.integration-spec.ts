import { randomUUID } from 'node:crypto';

import { Currency } from '../../src/common/enums/currency.enum';
import { DebtLoanStatus } from '../../src/modules/debts-loans/domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../src/modules/debts-loans/domain/enums/debt-loan-type.enum';
import { DebtLoanOrmEntity } from '../../src/modules/debts-loans/infrastructure/persistence/debt-loan.orm-entity';
import { DebtLoanPaymentOrmEntity } from '../../src/modules/debts-loans/infrastructure/persistence/debt-loan-payment.orm-entity';

import { TestDataSource } from './data-source';
import {
  buildUseCases,
  closeTestDatabase,
  initTestDatabase,
  partitionSettled,
  readPoolBalance,
  seedPoolBalance,
  truncateTables,
} from './harness';

/**
 * The lock proofs.
 *
 * The unit specs assert that each use case threads the transactional
 * `EntityManager` into its reads — they mock `dataSource.transaction`, so the
 * furthest they can go is "the plumbing is connected". Whether
 * `pessimistic_write` actually SERIALISES two overlapping transactions is a
 * property of Postgres, and only a real Postgres can answer it.
 *
 * Every case here has the same shape: fire the same operation twice at once,
 * then assert on the money. Without the lock each pair double-applies its
 * currency-pool delta; with it, the loser blocks until the winner commits,
 * re-reads the row it now sees, and its guard rejects it.
 *
 * These tests FAIL against the pre-lock code. That is the point — they are
 * the regression net the mocked specs cannot be.
 */

const USER = '00000000-0000-4000-8000-0000000000aa';
const OTHER_CURRENCY_NOISE = '00000000-0000-4000-8000-0000000000bb';

jest.setTimeout(30_000);

beforeAll(async () => {
  await initTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

beforeEach(async () => {
  await truncateTables();
});

async function seedDebt(overrides: Partial<DebtLoanOrmEntity> = {}): Promise<DebtLoanOrmEntity> {
  const repo = TestDataSource.getRepository(DebtLoanOrmEntity);
  return repo.save({
    id: randomUUID(),
    userId: USER,
    type: DebtLoanType.DEBT,
    categoryId: null,
    currency: Currency.PEN,
    amount: 100,
    remainingAmount: 100,
    status: DebtLoanStatus.PENDING,
    reference: 'Juan',
    description: null,
    date: new Date(),
    sourceMonthlyServicePaymentId: null,
    ...overrides,
  } as DebtLoanOrmEntity);
}

async function seedPayment(
  debtLoanId: string,
  amount: number,
  currency: Currency | null,
): Promise<DebtLoanPaymentOrmEntity> {
  const repo = TestDataSource.getRepository(DebtLoanPaymentOrmEntity);
  return repo.save({
    id: randomUUID(),
    debtLoanId,
    amount,
    currency,
    note: null,
    createdAt: new Date(),
  } as DebtLoanPaymentOrmEntity);
}

async function readDebt(id: string): Promise<DebtLoanOrmEntity> {
  const row = await TestDataSource.getRepository(DebtLoanOrmEntity).findOneByOrFail({ id });
  // NUMERIC comes back from pg as a string.
  return {
    ...row,
    amount: Number(row.amount),
    remainingAmount: Number(row.remainingAmount),
  };
}

async function countPayments(debtLoanId: string): Promise<number> {
  return TestDataSource.getRepository(DebtLoanPaymentOrmEntity).countBy({ debtLoanId });
}

describe('debts-loans money path under real concurrency', () => {
  describe('SettleDebtLoanUseCase — the double-tap', () => {
    it('lets exactly one of two overlapping settles through and moves the pool once', async () => {
      const debt = await seedDebt({ remainingAmount: 100, amount: 100 });
      const { settle } = buildUseCases();

      // 60 + 60 > 100. Unlocked, both read remainingAmount = 100, both pass
      // the exceeds-remaining guard, and the pool is debited 120.
      const { fulfilled, rejected } = partitionSettled(
        await Promise.allSettled([
          settle.execute(debt.id, USER, { settledAmount: 60, currency: Currency.PEN }),
          settle.execute(debt.id, USER, { settledAmount: 60, currency: Currency.PEN }),
        ]),
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({ code: 'DEBT_LOAN_SETTLEMENT_EXCEEDS_REMAINING' });

      const after = await readDebt(debt.id);
      expect(after.remainingAmount).toBe(40);
      expect(after.status).toBe(DebtLoanStatus.PENDING);

      // DEBT settle debits the pool. Exactly one settle landed, so exactly
      // one delta — this is the assertion that fails without the lock.
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(-60);
      expect(await countPayments(debt.id)).toBe(1);
    });

    it('keeps the payment history in step with the balance when both settles fit', async () => {
      const debt = await seedDebt({ remainingAmount: 100, amount: 100 });
      const { settle } = buildUseCases();

      // 40 + 40 <= 100, so BOTH are legitimate. The lock must serialise them
      // rather than reject one: the second reads remainingAmount = 60.
      const { fulfilled, rejected } = partitionSettled(
        await Promise.allSettled([
          settle.execute(debt.id, USER, { settledAmount: 40, currency: Currency.PEN }),
          settle.execute(debt.id, USER, { settledAmount: 40, currency: Currency.PEN }),
        ]),
      );

      expect(rejected).toHaveLength(0);
      expect(fulfilled).toHaveLength(2);

      expect((await readDebt(debt.id)).remainingAmount).toBe(20);
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(-80);
      expect(await countPayments(debt.id)).toBe(2);
    });

    it('closes the row exactly once when both settles would fully settle it', async () => {
      const debt = await seedDebt({ remainingAmount: 50, amount: 50 });
      const { settle } = buildUseCases();

      const { fulfilled, rejected } = partitionSettled(
        await Promise.allSettled([
          settle.execute(debt.id, USER, { settledAmount: 50, currency: Currency.PEN }),
          settle.execute(debt.id, USER, { settledAmount: 50, currency: Currency.PEN }),
        ]),
      );

      expect(fulfilled).toHaveLength(1);
      // The loser re-reads a SETTLED row, so ALREADY_SETTLED wins over
      // EXCEEDS_REMAINING — the guard order matters and this pins it.
      expect(rejected[0]).toMatchObject({ code: 'DEBT_LOAN_ALREADY_SETTLED' });

      const after = await readDebt(debt.id);
      expect(after.remainingAmount).toBe(0);
      expect(after.status).toBe(DebtLoanStatus.SETTLED);
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(-50);
    });
  });

  describe('DeleteDebtLoanPaymentUseCase — the money-from-nothing case', () => {
    it('credits the pool back exactly once when the same payment is deleted twice at once', async () => {
      const debt = await seedDebt({ amount: 100, remainingAmount: 60 });
      const payment = await seedPayment(debt.id, 40, Currency.PEN);
      // Mirror the state a real settle would have left: pool already debited.
      await seedPoolBalance(USER, Currency.PEN, -40);
      const { deletePayment } = buildUseCases();
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(-40);

      const { fulfilled, rejected } = partitionSettled(
        await Promise.allSettled([
          deletePayment.execute(payment.id, USER),
          deletePayment.execute(payment.id, USER),
        ]),
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({ code: 'DEBT_LOAN_PAYMENT_NOT_FOUND' });

      // Unlocked, both deletes see the payment as present and each credits 40
      // back — the pool lands on +40 and the user has been handed money that
      // never existed. Locked, it returns to 0.
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(0);
      expect((await readDebt(debt.id)).remainingAmount).toBe(100);
      expect(await countPayments(debt.id)).toBe(0);
    });
  });

  describe('UpdateDebtLoanPaymentUseCase', () => {
    it('applies the pool delta once when the same amount edit is submitted twice at once', async () => {
      const debt = await seedDebt({ amount: 100, remainingAmount: 60 });
      const payment = await seedPayment(debt.id, 40, Currency.PEN);
      await seedPoolBalance(USER, Currency.PEN, -40);
      const { updatePayment } = buildUseCases();

      // Both raise the payment 40 → 90.
      const { fulfilled, rejected } = partitionSettled(
        await Promise.allSettled([
          updatePayment.execute(payment.id, USER, { amount: 90 }),
          updatePayment.execute(payment.id, USER, { amount: 90 }),
        ]),
      );

      // BOTH succeed, and that is correct: "set the amount to 90" is
      // idempotent. Serialised by the lock, the loser re-reads a payment that
      // already holds 90, computes amountChanged = false, and does nothing —
      // no second delta, no error to surface to a user who did nothing wrong.
      //
      // Unlocked, both would read oldAmount = 40, each compute a +50 raise,
      // and debit the pool twice. The assertion that matters is the balance,
      // not the count of rejections.
      expect(rejected).toHaveLength(0);
      expect(fulfilled).toHaveLength(2);

      expect((await readDebt(debt.id)).remainingAmount).toBe(10);
      // One raise of +50 on a DEBT = a further 50 debited, never 100.
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(-90);
      expect(await countPayments(debt.id)).toBe(1);
    });

    it('holds remaining = amount − Σ payments when two different edits overlap', async () => {
      const debt = await seedDebt({ amount: 100, remainingAmount: 60 });
      const payment = await seedPayment(debt.id, 40, Currency.PEN);
      await seedPoolBalance(USER, Currency.PEN, -40);
      const { updatePayment } = buildUseCases();

      // 40 → 100 and 40 → 95. Both are legitimate: whichever runs second is
      // simply "adjust the amount again" against the state the first left, so
      // this is NOT about one of them being rejected. What it is about is the
      // invariant surviving.
      //
      // Unlocked, both read oldAmount = 40 and remaining = 60, each computes
      // its raise from that stale pair, and the pool lands on −155 while the
      // payment row holds one amount or the other — balance and history no
      // longer describe the same reality. Locked, the second edit is computed
      // against what the first actually wrote, and everything reconciles.
      const { fulfilled, rejected } = partitionSettled(
        await Promise.allSettled([
          updatePayment.execute(payment.id, USER, { amount: 100 }),
          updatePayment.execute(payment.id, USER, { amount: 95 }),
        ]),
      );

      expect(rejected).toHaveLength(0);
      expect(fulfilled).toHaveLength(2);

      const after = await readDebt(debt.id);
      const finalAmount = Number(
        (
          await TestDataSource.getRepository(DebtLoanPaymentOrmEntity).findOneByOrFail({
            id: payment.id,
          })
        ).amount,
      );

      // The two invariants the lock exists to protect, whichever edit landed last.
      expect(after.remainingAmount).toBe(100 - finalAmount);
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(-finalAmount);
      expect(await countPayments(debt.id)).toBe(1);
    });
  });

  describe('BulkSettleByReferenceUseCase', () => {
    it('settles the reference once when two bulk settles overlap', async () => {
      await seedDebt({ remainingAmount: 30, amount: 30, reference: 'Juan' });
      await seedDebt({ remainingAmount: 70, amount: 70, reference: 'Juan' });
      const { bulkSettle } = buildUseCases();

      const { fulfilled, rejected } = partitionSettled(
        await Promise.allSettled([
          bulkSettle.execute(USER, { reference: 'Juan', currency: Currency.PEN }),
          bulkSettle.execute(USER, { reference: 'Juan', currency: Currency.PEN }),
        ]),
      );

      // Neither errors — an empty pending set is a legitimate zero result.
      expect(rejected).toHaveLength(0);
      const counts = fulfilled.map((r) => r.settledCount).sort();
      expect(counts).toEqual([0, 2]);

      // 100 debited once, not twice.
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(-100);
    });

    it('matches the reference case- and accent-insensitively while still locking', async () => {
      await seedDebt({ remainingAmount: 50, amount: 50, reference: 'Jose' });
      const { bulkSettle } = buildUseCases();

      const { fulfilled } = partitionSettled(
        await Promise.allSettled([
          bulkSettle.execute(USER, { reference: 'josé', currency: Currency.PEN }),
          bulkSettle.execute(USER, { reference: 'JOSE', currency: Currency.PEN }),
        ]),
      );

      expect(fulfilled.map((r) => r.settledCount).sort()).toEqual([0, 1]);
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(-50);
    });
  });

  describe('SettleAmountByReferenceUseCase — already locked, now proven', () => {
    it('distributes the amount FIFO once across two overlapping settles', async () => {
      const older = await seedDebt({
        remainingAmount: 30,
        amount: 30,
        reference: 'Juan',
        date: new Date('2026-01-01'),
      });
      await seedDebt({
        remainingAmount: 70,
        amount: 70,
        reference: 'Juan',
        date: new Date('2026-02-01'),
      });
      const { settleAmount } = buildUseCases();

      const { fulfilled, rejected } = partitionSettled(
        await Promise.allSettled([
          settleAmount.execute(USER, {
            reference: 'Juan',
            currency: Currency.PEN,
            type: DebtLoanType.DEBT,
            amount: 50,
            realPayment: true,
          }),
          settleAmount.execute(USER, {
            reference: 'Juan',
            currency: Currency.PEN,
            type: DebtLoanType.DEBT,
            amount: 50,
            realPayment: true,
          }),
        ]),
      );

      // Both are legitimate: 50 + 50 = 100 = the total pending. Serialised,
      // the first takes the older row whole (30) plus 20 off the newer; the
      // second takes the newer row's remaining 50.
      expect(rejected).toHaveLength(0);
      expect(fulfilled).toHaveLength(2);
      expect((await readDebt(older.id)).remainingAmount).toBe(0);
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(-100);
    });
  });

  describe('isolation between users', () => {
    it('does not let one user’s lock block another user’s settle', async () => {
      const mine = await seedDebt({ remainingAmount: 100, amount: 100 });
      const theirs = await seedDebt({
        userId: OTHER_CURRENCY_NOISE,
        remainingAmount: 100,
        amount: 100,
      });
      const { settle } = buildUseCases();

      const { fulfilled, rejected } = partitionSettled(
        await Promise.allSettled([
          settle.execute(mine.id, USER, { settledAmount: 100, currency: Currency.PEN }),
          settle.execute(theirs.id, OTHER_CURRENCY_NOISE, {
            settledAmount: 100,
            currency: Currency.PEN,
          }),
        ]),
      );

      // Row-level locks, not table-level: different rows never contend.
      expect(rejected).toHaveLength(0);
      expect(fulfilled).toHaveLength(2);
      expect(await readPoolBalance(USER, Currency.PEN)).toBe(-100);
      expect(await readPoolBalance(OTHER_CURRENCY_NOISE, Currency.PEN)).toBe(-100);
    });
  });
});
