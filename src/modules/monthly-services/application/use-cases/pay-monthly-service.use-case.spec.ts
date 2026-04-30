import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { DomainException } from '@common/exceptions/domain.exception';
import { buildAccount } from '@modules/accounts/domain/__tests__/account.factory';
import { type AccountRepository } from '@modules/accounts/domain/account.repository';
import { Currency } from '@modules/accounts/domain/enums/currency.enum';
import { buildTransaction } from '@modules/transactions/domain/__tests__/transaction.factory';
import { TransactionType } from '@modules/transactions/domain/enums/transaction-type.enum';
import { type TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { PayMonthlyServiceUseCase } from './pay-monthly-service.use-case';

describe('PayMonthlyServiceUseCase', () => {
  let useCase: PayMonthlyServiceUseCase;
  let serviceRepo: jest.Mocked<MonthlyServiceRepository>;
  let txRepo: jest.Mocked<TransactionRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  const userId = 'user-1';
  // Represents "today" as the client timezone sees it. Use cases receive this
  // from the controller — kept as a constant so every test reads the same way.
  const CURRENT_PERIOD = '2026-04';
  const TZ = 'America/Lima';

  beforeEach(() => {
    serviceRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      softDelete: jest.fn(),
    };

    txRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findByRelatedTransactionId: jest.fn(),
      save: jest.fn().mockImplementation((tx) => Promise.resolve(tx)),
      softDelete: jest.fn(),
      existsByAccountId: jest.fn(),
      aggregateDebtsByReference: jest.fn(),
      findPendingDebtOrLoanByNormalizedReference: jest.fn(),
      sumFlowByCurrencyInRange: jest.fn(),
      topExpenseCategoriesInRange: jest.fn(),
      dailyNetFlowInRange: jest.fn(),
      countByMonthlyServiceId: jest.fn(),
      findLastNByMonthlyServiceId: jest.fn().mockResolvedValue([]),
      findByBudgetId: jest.fn(),
      sumAmountByBudgetId: jest.fn(),
      clearBudgetIdForBudget: jest.fn(),
    };

    accountRepo = {
      findByUserId: jest.fn(),
      findByUserIdAndName: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
      softDelete: jest.fn(),
    };

    mockLogger = buildMockPinoLogger();
    useCase = new PayMonthlyServiceUseCase(
      serviceRepo,
      txRepo,
      accountRepo,
      mockLogger as unknown as PinoLogger,
    );
  });

  it('creates an EXPENSE transaction, debits the default account, and advances the period', async () => {
    const service = buildMonthlyService({
      userId,
      currency: 'PEN',
      startPeriod: '2026-04',
      lastPaidPeriod: null,
      defaultAccountId: 'acc-1',
    });
    const account = buildAccount({
      id: 'acc-1',
      userId,
      currency: Currency.PEN,
      balance: 500,
    });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(account);

    const { transaction, service: updated } = await useCase.execute(
      service.id,
      userId,
      { amount: 42 },
      CURRENT_PERIOD,
      TZ,
    );

    expect(transaction.type).toBe(TransactionType.EXPENSE);
    expect(transaction.amount).toBe(42);
    expect(transaction.accountId).toBe('acc-1');
    expect(transaction.monthlyServiceId).toBe(service.id);
    expect(transaction.categoryId).toBe(service.categoryId);
    expect(account.balance).toBe(458);
    expect(updated.lastPaidPeriod).toBe('2026-04');
  });

  it('uses accountIdOverride when provided', async () => {
    const service = buildMonthlyService({
      userId,
      currency: 'PEN',
      defaultAccountId: 'acc-1',
      lastPaidPeriod: '2026-03',
    });
    const override = buildAccount({
      id: 'acc-2',
      userId,
      currency: Currency.PEN,
      balance: 1000,
    });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(override);

    const { transaction } = await useCase.execute(
      service.id,
      userId,
      { amount: 20, accountIdOverride: 'acc-2' },
      CURRENT_PERIOD,
      TZ,
    );

    expect(transaction.accountId).toBe('acc-2');
    expect(accountRepo.findById).toHaveBeenCalledWith('acc-2');
    expect(override.balance).toBe(980);
  });

  it('defaults description to the service name when omitted', async () => {
    const service = buildMonthlyService({ userId, name: 'Netflix', currency: 'PEN' });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: service.defaultAccountId, userId, currency: Currency.PEN }),
    );

    const { transaction } = await useCase.execute(
      service.id,
      userId,
      { amount: 10 },
      CURRENT_PERIOD,
      TZ,
    );

    expect(transaction.description).toBe('Netflix');
  });

  it('advances lastPaidPeriod by `frequencyMonths` (quarterly: April -> July)', async () => {
    // Quarterly service paid for April -> next due jumps to July, not May.
    const service = buildMonthlyService({
      userId,
      currency: 'PEN',
      frequencyMonths: 3,
      startPeriod: '2026-04',
      lastPaidPeriod: null,
    });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: service.defaultAccountId, userId, currency: Currency.PEN }),
    );

    const { service: updated } = await useCase.execute(
      service.id,
      userId,
      { amount: 100 },
      CURRENT_PERIOD,
      TZ,
    );

    expect(updated.lastPaidPeriod).toBe('2026-04');
    expect(updated.nextDuePeriod()).toBe('2026-07');
  });

  it('recomputes dueDay as the rounded average day-of-month of the last 3 payments', async () => {
    // Service starts with no dueDay set; the recompute fills it in based on
    // when the user actually pays. Mirror of the estimatedAmount logic.
    const service = buildMonthlyService({ userId, currency: 'PEN', dueDay: null });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: service.defaultAccountId, userId, currency: Currency.PEN }),
    );
    // Days 14, 16, 15 in America/Lima -> avg = 15.
    txRepo.findLastNByMonthlyServiceId.mockResolvedValue([
      buildTransaction({ date: new Date('2026-01-14T12:00:00-05:00') }),
      buildTransaction({ date: new Date('2026-02-16T12:00:00-05:00') }),
      buildTransaction({ date: new Date('2026-03-15T12:00:00-05:00') }),
    ]);

    const { service: updated } = await useCase.execute(
      service.id,
      userId,
      { amount: 50 },
      CURRENT_PERIOD,
      TZ,
    );

    expect(updated.dueDay).toBe(15);
  });

  it('keeps the previous dueDay when there are no past payments to average', async () => {
    // The new transaction is created BEFORE recompute reads the recent list,
    // but our test mocks `findLastNByMonthlyServiceId` directly — so we can
    // simulate "no recent payments" here. With nothing to average, the use
    // case must keep whatever dueDay the service already had.
    const service = buildMonthlyService({ userId, currency: 'PEN', dueDay: 10 });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: service.defaultAccountId, userId, currency: Currency.PEN }),
    );
    txRepo.findLastNByMonthlyServiceId.mockResolvedValue([]);

    const { service: updated } = await useCase.execute(
      service.id,
      userId,
      { amount: 50 },
      CURRENT_PERIOD,
      TZ,
    );

    expect(updated.dueDay).toBe(10);
  });

  it('recomputes estimatedAmount as the average of the last 3 payments', async () => {
    const service = buildMonthlyService({ userId, currency: 'PEN', estimatedAmount: 100 });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: service.defaultAccountId, userId, currency: Currency.PEN }),
    );
    txRepo.findLastNByMonthlyServiceId.mockResolvedValue([
      buildTransaction({ amount: 60 }),
      buildTransaction({ amount: 40 }),
      buildTransaction({ amount: 50 }),
    ]);

    const { service: updated } = await useCase.execute(
      service.id,
      userId,
      { amount: 60 },
      CURRENT_PERIOD,
      TZ,
    );

    // AVG(60, 40, 50) = 50
    expect(updated.estimatedAmount).toBe(50);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when the id is unknown', async () => {
    serviceRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', userId, { amount: 10 }, CURRENT_PERIOD, TZ)).rejects.toThrow(
      DomainException,
    );
  });

  it('hides services owned by another user behind MONTHLY_SERVICE_NOT_FOUND', async () => {
    serviceRepo.findById.mockResolvedValue(buildMonthlyService({ userId: 'other' }));

    await expect(useCase.execute('x', userId, { amount: 10 }, CURRENT_PERIOD, TZ)).rejects.toThrow(
      'Servicio mensual no encontrado',
    );
  });

  it('throws MONTHLY_SERVICE_ALREADY_PAID when the service is up to date for the current month', async () => {
    // lastPaidPeriod = '2026-04' → nextDuePeriod = '2026-05' → strictly > currentPeriod,
    // which means isPaidForMonth(CURRENT_PERIOD) === true.
    const service = buildMonthlyService({
      userId,
      currency: 'PEN',
      lastPaidPeriod: CURRENT_PERIOD,
    });
    serviceRepo.findById.mockResolvedValue(service);

    await expect(
      useCase.execute(service.id, userId, { amount: 42 }, CURRENT_PERIOD, TZ),
    ).rejects.toThrow('El servicio ya está pagado para el mes actual');

    // No side effects: no account debit, no transaction saved, no service update.
    expect(accountRepo.save).not.toHaveBeenCalled();
    expect(txRepo.save).not.toHaveBeenCalled();
    expect(serviceRepo.save).not.toHaveBeenCalled();
  });

  it('throws ACCOUNT_NOT_FOUND when the resolved account does not exist', async () => {
    serviceRepo.findById.mockResolvedValue(buildMonthlyService({ userId, currency: 'PEN' }));
    accountRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('svc', userId, { amount: 10 }, CURRENT_PERIOD, TZ),
    ).rejects.toThrow('Cuenta no encontrada');
  });

  it('throws CURRENCY_MISMATCH when the paying account has a different currency', async () => {
    const service = buildMonthlyService({ userId, currency: 'PEN' });
    serviceRepo.findById.mockResolvedValue(service);
    accountRepo.findById.mockResolvedValue(
      buildAccount({ id: service.defaultAccountId, userId, currency: Currency.USD }),
    );

    await expect(
      useCase.execute(service.id, userId, { amount: 10 }, CURRENT_PERIOD, TZ),
    ).rejects.toThrow('La cuenta de pago debe tener la misma moneda que el servicio');
  });
});
