import { type PinoLogger } from 'nestjs-pino';
import { type DataSource, type EntityManager } from 'typeorm';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';
import { type CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';
import { type DebtLoanSettlementComposer } from '@modules/debts-loans/application/services/debt-loan-settlement-composer';
import { DebtLoanStatus } from '@modules/debts-loans/domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '@modules/debts-loans/domain/enums/debt-loan-type.enum';
import { buildMonthlyService } from '@modules/monthly-services/domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '@modules/monthly-services/domain/monthly-service.repository';

import { buildMonthlyServicePayment } from '../../../domain/__tests__/monthly-service-payment.factory';
import { type MonthlyServicePaymentRepository } from '../../../domain/monthly-service-payment.repository';
import { CreateMonthlyServicePaymentUseCase } from '../create-monthly-service-payment.use-case';

function buildLoanStub(overrides: Partial<{ id: string; reference: string; amount: number }> = {}) {
  const now = new Date('2026-06-01T00:00:00.000Z');
  return {
    id: overrides.id ?? 'loan-1',
    userId: 'user-1',
    type: DebtLoanType.LOAN,
    categoryId: null,
    currency: Currency.PEN,
    amount: overrides.amount ?? 100,
    remainingAmount: overrides.amount ?? 100,
    status: DebtLoanStatus.PENDING,
    reference: overrides.reference ?? 'Ana',
    description: null,
    date: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    sourceMonthlyServicePaymentId: 'payment-x',
  };
}

describe('CreateMonthlyServicePaymentUseCase', () => {
  let repo: jest.Mocked<MonthlyServicePaymentRepository>;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let pool: jest.Mocked<CurrencyPoolService>;
  let composer: jest.Mocked<
    Pick<DebtLoanSettlementComposer, 'createLinked' | 'createAndSettleLinked'>
  >;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let useCase: CreateMonthlyServicePaymentUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const USER = 'user-1';
  const SERVICE = 'service-1';
  const TIMEZONE = 'America/Lima';
  const FAKE_MGR = { tx: true } as unknown as EntityManager;

  beforeEach(() => {
    repo = {
      findByServiceId: jest.fn(),
      findByServiceIds: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      findByServiceAndPeriod: jest.fn(),
      sumByCurrencyInRange: jest.fn(),
      dailyByCurrencyInRange: jest.fn(),
      findLastNByServiceId: jest.fn().mockResolvedValue([]),
      sumByServiceIdsInPeriod: jest.fn().mockResolvedValue(new Map()),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      softDelete: jest.fn(),
    };
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      softDelete: jest.fn(),
    };
    pool = { applyDelta: jest.fn() } as unknown as jest.Mocked<CurrencyPoolService>;
    composer = {
      createLinked: jest
        .fn()
        .mockImplementation((_m, input) => Promise.resolve(buildLoanStub(input))),
      createAndSettleLinked: jest.fn().mockImplementation((_m, input) =>
        Promise.resolve({
          ...buildLoanStub(input),
          status: DebtLoanStatus.SETTLED,
          remainingAmount: 0,
        }),
      ),
    };
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
    };
    logger = buildMockPinoLogger();
    useCase = new CreateMonthlyServicePaymentUseCase(
      repo,
      serviceRepo,
      pool,
      composer as unknown as DebtLoanSettlementComposer,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
  });

  describe('guards', () => {
    it('throws MSP_005 for malformed period (entity-level validation)', async () => {
      await expect(
        useCase.execute(
          USER,
          { monthlyServiceId: SERVICE, period: '2026-13', amount: 30 },
          TIMEZONE,
        ),
      ).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_INVALID_PERIOD_FORMAT',
      } satisfies Partial<DomainException>);
    });

    it('throws MONTHLY_SERVICE_NOT_FOUND when the service does not exist', async () => {
      serviceRepo.findById.mockResolvedValue(null);
      await expect(
        useCase.execute(
          USER,
          { monthlyServiceId: SERVICE, period: '2026-06', amount: 30 },
          TIMEZONE,
        ),
      ).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_NOT_FOUND',
      } satisfies Partial<DomainException>);
    });

    it('throws MSP_002 for cross-user service access', async () => {
      serviceRepo.findById.mockResolvedValue(
        buildMonthlyService({ id: SERVICE, userId: 'someone-else' }),
      );
      await expect(
        useCase.execute(
          USER,
          { monthlyServiceId: SERVICE, period: '2026-06', amount: 30 },
          TIMEZONE,
        ),
      ).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER',
      } satisfies Partial<DomainException>);
    });

    it('throws MSP_003 when a payment already exists for the (service, period) pair', async () => {
      serviceRepo.findById.mockResolvedValue(buildMonthlyService({ id: SERVICE, userId: USER }));
      repo.findByServiceAndPeriod.mockResolvedValue(
        buildMonthlyServicePayment({ monthlyServiceId: SERVICE, period: '2026-06' }),
      );
      await expect(
        useCase.execute(
          USER,
          { monthlyServiceId: SERVICE, period: '2026-06', amount: 30 },
          TIMEZONE,
        ),
      ).rejects.toMatchObject({
        code: 'MONTHLY_SERVICE_PAYMENT_ALREADY_EXISTS_FOR_PERIOD',
      } satisfies Partial<DomainException>);
    });
  });

  describe('happy path', () => {
    beforeEach(() => {
      serviceRepo.findById.mockResolvedValue(
        buildMonthlyService({ id: SERVICE, userId: USER, currency: Currency.PEN }),
      );
      repo.findByServiceAndPeriod.mockResolvedValue(null);
    });

    it('persists the payment and applies a NEGATIVE pool delta of `amount`', async () => {
      await useCase.execute(
        USER,
        { monthlyServiceId: SERVICE, period: '2026-06', amount: 45.5 },
        TIMEZONE,
      );

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -45.5, FAKE_MGR);
      expect(repo.save).toHaveBeenCalledWith(expect.anything(), FAKE_MGR);
    });

    it('inherits currency from the service (NOT the DTO)', async () => {
      const result = await useCase.execute(
        USER,
        { monthlyServiceId: SERVICE, period: '2026-06', amount: 30 },
        TIMEZONE,
      );
      expect(result.currency).toBe(Currency.PEN);
    });

    it('uses dto.date when provided, otherwise now', async () => {
      const result = await useCase.execute(
        USER,
        {
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 30,
          date: '2026-06-15T12:00:00.000Z',
        },
        TIMEZONE,
      );
      expect(result.date.toISOString()).toBe('2026-06-15T12:00:00.000Z');
    });

    it('logs creation with period + poolDelta', async () => {
      await useCase.execute(
        USER,
        { monthlyServiceId: SERVICE, period: '2026-06', amount: 30 },
        TIMEZONE,
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'monthly_service_payment.created',
          period: '2026-06',
          poolDelta: -30,
        }),
        'monthly_service_payment.created',
      );
    });
  });

  describe('service entity sync (v1.0.0 fix)', () => {
    // The MSP create use case must SYNC the monthly_services row inside the
    // same tx — advancing lastPaidPeriod (forward-only) and recomputing
    // estimatedAmount + dueDay from the recent payments. Without this the
    // GET /monthly-services list keeps reporting the service as overdue.
    beforeEach(() => {
      repo.findByServiceAndPeriod.mockResolvedValue(null);
    });

    it('advances service.lastPaidPeriod to the new period when it is later than what is stored', async () => {
      const service = buildMonthlyService({
        id: SERVICE,
        userId: USER,
        currency: Currency.PEN,
        lastPaidPeriod: '2026-04',
      });
      serviceRepo.findById.mockResolvedValue(service);

      await useCase.execute(
        USER,
        { monthlyServiceId: SERVICE, period: '2026-05', amount: 50 },
        TIMEZONE,
      );

      expect(service.lastPaidPeriod).toBe('2026-05');
      expect(serviceRepo.save).toHaveBeenCalledWith(service, FAKE_MGR);
    });

    it('does NOT regress service.lastPaidPeriod when back-paying an earlier period', async () => {
      const service = buildMonthlyService({
        id: SERVICE,
        userId: USER,
        currency: Currency.PEN,
        lastPaidPeriod: '2026-06',
      });
      serviceRepo.findById.mockResolvedValue(service);

      await useCase.execute(
        USER,
        { monthlyServiceId: SERVICE, period: '2026-03', amount: 50 },
        TIMEZONE,
      );

      // Stored pointer stays at 2026-06 — back-paying March should never
      // tell the system that the user is now only paid through March.
      expect(service.lastPaidPeriod).toBe('2026-06');
      // The service IS still saved (estimatedAmount/dueDay may have moved).
      expect(serviceRepo.save).toHaveBeenCalledWith(service, FAKE_MGR);
    });

    it('first payment ever (lastPaidPeriod=null) advances to the new period', async () => {
      const service = buildMonthlyService({
        id: SERVICE,
        userId: USER,
        currency: Currency.PEN,
        lastPaidPeriod: null,
      });
      serviceRepo.findById.mockResolvedValue(service);

      await useCase.execute(
        USER,
        { monthlyServiceId: SERVICE, period: '2026-06', amount: 50 },
        TIMEZONE,
      );

      expect(service.lastPaidPeriod).toBe('2026-06');
    });

    it('snaps dueDay to the day of the MOST RECENT payment (not the moving average across the window)', async () => {
      // The window holds three historic payments on day 5 + a brand-new
      // one on day 22 (the row just persisted, surfaced through the
      // shared transaction manager). A moving average would land near
      // day 9 — what we want is day 22, full stop.
      const service = buildMonthlyService({
        id: SERVICE,
        userId: USER,
        currency: Currency.PEN,
        lastPaidPeriod: '2026-05',
        dueDay: 5,
      });
      serviceRepo.findById.mockResolvedValue(service);
      repo.findLastNByServiceId.mockResolvedValue([
        buildMonthlyServicePayment({
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 50,
          date: new Date('2026-06-22T15:00:00.000Z'),
        }),
        buildMonthlyServicePayment({
          monthlyServiceId: SERVICE,
          period: '2026-05',
          amount: 50,
          date: new Date('2026-05-05T15:00:00.000Z'),
        }),
        buildMonthlyServicePayment({
          monthlyServiceId: SERVICE,
          period: '2026-04',
          amount: 50,
          date: new Date('2026-04-05T15:00:00.000Z'),
        }),
      ]);

      await useCase.execute(
        USER,
        { monthlyServiceId: SERVICE, period: '2026-06', amount: 50 },
        TIMEZONE,
      );

      expect(service.dueDay).toBe(22);
    });

    it('sets estimatedAmount to the MOST RECENT payment amount (not the moving average)', async () => {
      // Window holds three payments with distinct amounts. A moving average
      // would land on 40 ((80 + 30 + 10) / 3); the user wants the estimate to
      // be exactly the last payment made: 80.
      const service = buildMonthlyService({
        id: SERVICE,
        userId: USER,
        currency: Currency.PEN,
        lastPaidPeriod: '2026-05',
        estimatedAmount: 40,
      });
      serviceRepo.findById.mockResolvedValue(service);
      repo.findLastNByServiceId.mockResolvedValue([
        buildMonthlyServicePayment({
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 80,
          date: new Date('2026-06-22T15:00:00.000Z'),
        }),
        buildMonthlyServicePayment({
          monthlyServiceId: SERVICE,
          period: '2026-05',
          amount: 30,
          date: new Date('2026-05-05T15:00:00.000Z'),
        }),
        buildMonthlyServicePayment({
          monthlyServiceId: SERVICE,
          period: '2026-04',
          amount: 10,
          date: new Date('2026-04-05T15:00:00.000Z'),
        }),
      ]);

      await useCase.execute(
        USER,
        { monthlyServiceId: SERVICE, period: '2026-06', amount: 80 },
        TIMEZONE,
      );

      expect(service.estimatedAmount).toBe(80);
    });
  });

  describe('pay-with-splits (shared-service-payments slice 2)', () => {
    beforeEach(() => {
      serviceRepo.findById.mockResolvedValue(
        buildMonthlyService({ id: SERVICE, userId: USER, currency: Currency.PEN }),
      );
      repo.findByServiceAndPeriod.mockResolvedValue(null);
    });

    it('rejects BEFORE any mutation when sum(participants) exceeds the total', async () => {
      await expect(
        useCase.execute(
          USER,
          {
            monthlyServiceId: SERVICE,
            period: '2026-06',
            amount: 300,
            participants: [
              { reference: 'Ana', amount: 200 },
              { reference: 'Luis', amount: 150 },
            ],
          },
          TIMEZONE,
        ),
      ).rejects.toMatchObject({
        code: 'MSP_SPLIT_EXCEEDS_TOTAL',
      } satisfies Partial<DomainException>);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(pool.applyDelta).not.toHaveBeenCalled();
      expect(composer.createLinked).not.toHaveBeenCalled();
    });

    it('accepts when sum(participants) exactly equals the total (boundary, not exceeds)', async () => {
      await useCase.execute(
        USER,
        {
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 180,
          participants: [
            { reference: 'Ana', amount: 100 },
            { reference: 'Luis', amount: 80 },
          ],
        },
        TIMEZONE,
      );

      expect(composer.createLinked).toHaveBeenCalledTimes(2);
    });

    it('debits the pool by the FULL bill amount, not just the own share', async () => {
      await useCase.execute(
        USER,
        {
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 300,
          participants: [
            { reference: 'Ana', amount: 100 },
            { reference: 'Luis', amount: 80 },
          ],
        },
        TIMEZONE,
      );

      // Own share (120) generates NO row; the pool debit is still the full 300.
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -300, FAKE_MGR);
    });

    it('creates one PENDING LOAN per unpaid participant, linked to the saved payment, on the same manager', async () => {
      await useCase.execute(
        USER,
        {
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 300,
          participants: [
            { reference: 'Ana', amount: 100 },
            { reference: 'Luis', amount: 80 },
          ],
        },
        TIMEZONE,
      );

      expect(composer.createLinked).toHaveBeenCalledTimes(2);
      expect(composer.createAndSettleLinked).not.toHaveBeenCalled();
      expect(composer.createLinked).toHaveBeenCalledWith(
        FAKE_MGR,
        expect.objectContaining({
          userId: USER,
          reference: 'Ana',
          currency: Currency.PEN,
          amount: 100,
        }),
      );
      expect(composer.createLinked).toHaveBeenCalledWith(
        FAKE_MGR,
        expect.objectContaining({
          userId: USER,
          reference: 'Luis',
          currency: Currency.PEN,
          amount: 80,
        }),
      );
    });

    it('uses the RAW (non-normalized) participant reference for the generated LOAN (normalizeReference/unaccent divergence gotcha)', async () => {
      // Design decision resolving the normalizeReference (JS) vs Postgres
      // unaccent() divergence flagged in the slice-1 review: the generated
      // LOAN's `reference` is written EXACTLY as the participant typed it —
      // never routed through `common/text/normalize-reference.ts`. This
      // means the LOAN is grouped/matched via the SAME
      // `LOWER(unaccent(dl.reference))` SQL clause every other manually
      // -created debt uses (`aggregateByReference`,
      // `findPendingByNormalizedReference`), so there is no divergence to
      // worry about — the JS normalizer is never in this code path at all.
      await useCase.execute(
        USER,
        {
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 100,
          participants: [{ reference: '  José María  ', amount: 100 }],
        },
        TIMEZONE,
      );

      expect(composer.createLinked).toHaveBeenCalledWith(
        FAKE_MGR,
        expect.objectContaining({ reference: '  José María  ' }),
      );
    });

    it('links every generated LOAN to the id of the SAVED payment', async () => {
      repo.save.mockImplementation((p) => Promise.resolve({ ...p, id: 'payment-42' }) as never);

      await useCase.execute(
        USER,
        {
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 100,
          participants: [{ reference: 'Ana', amount: 100 }],
        },
        TIMEZONE,
      );

      expect(composer.createLinked).toHaveBeenCalledWith(
        FAKE_MGR,
        expect.objectContaining({ sourceMonthlyServicePaymentId: 'payment-42' }),
      );
    });

    it('already-paid participant settles immediately via createAndSettleLinked (create+settle, same manager)', async () => {
      await useCase.execute(
        USER,
        {
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 100,
          participants: [{ reference: 'Ana', amount: 100, alreadyPaid: true }],
        },
        TIMEZONE,
      );

      expect(composer.createAndSettleLinked).toHaveBeenCalledTimes(1);
      expect(composer.createAndSettleLinked).toHaveBeenCalledWith(
        FAKE_MGR,
        expect.objectContaining({ reference: 'Ana', amount: 100 }),
      );
      expect(composer.createLinked).not.toHaveBeenCalled();
    });

    it('mixes unpaid (createLinked) and already-paid (createAndSettleLinked) participants correctly', async () => {
      await useCase.execute(
        USER,
        {
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 180,
          participants: [
            { reference: 'Ana', amount: 100, alreadyPaid: true },
            { reference: 'Luis', amount: 80, alreadyPaid: false },
          ],
        },
        TIMEZONE,
      );

      expect(composer.createAndSettleLinked).toHaveBeenCalledTimes(1);
      expect(composer.createAndSettleLinked).toHaveBeenCalledWith(
        FAKE_MGR,
        expect.objectContaining({ reference: 'Ana' }),
      );
      expect(composer.createLinked).toHaveBeenCalledTimes(1);
      expect(composer.createLinked).toHaveBeenCalledWith(
        FAKE_MGR,
        expect.objectContaining({ reference: 'Luis' }),
      );
    });

    it('empty participants array behaves EXACTLY like a non-shared payment (no LOAN rows, regression guard)', async () => {
      await useCase.execute(
        USER,
        { monthlyServiceId: SERVICE, period: '2026-06', amount: 50, participants: [] },
        TIMEZONE,
      );

      expect(composer.createLinked).not.toHaveBeenCalled();
      expect(composer.createAndSettleLinked).not.toHaveBeenCalled();
      expect(pool.applyDelta).toHaveBeenCalledWith(USER, Currency.PEN, -50, FAKE_MGR);
    });

    it('omitted participants field behaves EXACTLY like a non-shared payment (no LOAN rows, regression guard)', async () => {
      await useCase.execute(
        USER,
        { monthlyServiceId: SERVICE, period: '2026-06', amount: 50 },
        TIMEZONE,
      );

      expect(composer.createLinked).not.toHaveBeenCalled();
      expect(composer.createAndSettleLinked).not.toHaveBeenCalled();
    });

    it('all composer calls happen inside the SAME dataSource.transaction as the payment (single manager, no nested tx)', async () => {
      await useCase.execute(
        USER,
        {
          monthlyServiceId: SERVICE,
          period: '2026-06',
          amount: 180,
          participants: [
            { reference: 'Ana', amount: 100, alreadyPaid: true },
            { reference: 'Luis', amount: 80 },
          ],
        },
        TIMEZONE,
      );

      // Exactly ONE dataSource.transaction call for the whole operation —
      // the composer must never open a second one.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('rolls back everything (no partial debt/pool state) when a composer call fails mid-loop', async () => {
      composer.createLinked.mockRejectedValueOnce(new Error('boom'));

      await expect(
        useCase.execute(
          USER,
          {
            monthlyServiceId: SERVICE,
            period: '2026-06',
            amount: 180,
            participants: [
              { reference: 'Ana', amount: 100, alreadyPaid: true },
              { reference: 'Luis', amount: 80 },
            ],
          },
          TIMEZONE,
        ),
      ).rejects.toThrow('boom');

      // The failure propagated OUT of the dataSource.transaction callback —
      // in production TypeORM would roll back the whole tx. We can't assert
      // DB state from a unit test, but we CAN assert the use case never
      // caught/swallowed the error to fake a partial success.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });
});
