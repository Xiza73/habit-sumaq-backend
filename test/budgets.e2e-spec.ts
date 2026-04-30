/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';

import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';
import { buildAccount } from '../src/modules/accounts/domain/__tests__/account.factory';
import { AccountRepository } from '../src/modules/accounts/domain/account.repository';
import { Currency } from '../src/modules/accounts/domain/enums/currency.enum';
import { JwtAccessStrategy } from '../src/modules/auth/infrastructure/strategies/jwt-access.strategy';
import { AddBudgetMovementUseCase } from '../src/modules/budgets/application/use-cases/add-budget-movement.use-case';
import { CreateBudgetUseCase } from '../src/modules/budgets/application/use-cases/create-budget.use-case';
import { DeleteBudgetUseCase } from '../src/modules/budgets/application/use-cases/delete-budget.use-case';
import { GetBudgetUseCase } from '../src/modules/budgets/application/use-cases/get-budget.use-case';
import { GetCurrentBudgetUseCase } from '../src/modules/budgets/application/use-cases/get-current-budget.use-case';
import { ListBudgetsUseCase } from '../src/modules/budgets/application/use-cases/list-budgets.use-case';
import { UpdateBudgetUseCase } from '../src/modules/budgets/application/use-cases/update-budget.use-case';
import { makeBudget } from '../src/modules/budgets/domain/__tests__/budget.factory';
import { BudgetRepository } from '../src/modules/budgets/domain/budget.repository';
import { BudgetsController } from '../src/modules/budgets/presentation/budgets.controller';
import { buildCategory } from '../src/modules/categories/domain/__tests__/category.factory';
import { CategoryRepository } from '../src/modules/categories/domain/category.repository';
import { TransactionRepository } from '../src/modules/transactions/domain/transaction.repository';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-budgets-jwt-secret-min-32-characters!!';
const USER_ID = 'e2e-user-uuid-bdgt-0001';
const ACC_PEN = '00000000-0000-4000-a000-000000000021';
const ACC_USD = '00000000-0000-4000-a000-000000000022';
const CAT_ID = '00000000-0000-4000-b000-000000000021';
const BUDGET_ID = '00000000-0000-4000-c000-000000000021';

describe('BudgetsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockBudgetRepo: jest.Mocked<BudgetRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    findByPeriodAndCurrency: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockTxRepo: jest.Mocked<TransactionRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    findByRelatedTransactionId: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    existsByAccountId: jest.fn(),
    aggregateDebtsByReference: jest.fn(),
    findPendingDebtOrLoanByNormalizedReference: jest.fn(),
    sumFlowByCurrencyInRange: jest.fn(),
    topExpenseCategoriesInRange: jest.fn(),
    dailyNetFlowInRange: jest.fn(),
    countByMonthlyServiceId: jest.fn(),
    findLastNByMonthlyServiceId: jest.fn(),
    findByBudgetId: jest.fn(),
    sumAmountByBudgetId: jest.fn(),
    clearBudgetIdForBudget: jest.fn(),
  };

  const mockAccountRepo: jest.Mocked<AccountRepository> = {
    findByUserId: jest.fn(),
    findByUserIdAndName: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockCategoryRepo: jest.Mocked<CategoryRepository> = {
    findByUserId: jest.fn(),
    findByUserIdAndName: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => (key === 'jwt.accessSecret' ? TEST_JWT_SECRET : undefined)),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'jwt.accessSecret') return TEST_JWT_SECRET;
      throw new Error(`Config key not found in test: ${key}`);
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({})],
      controllers: [BudgetsController],
      providers: [
        ListBudgetsUseCase,
        GetCurrentBudgetUseCase,
        GetBudgetUseCase,
        CreateBudgetUseCase,
        UpdateBudgetUseCase,
        DeleteBudgetUseCase,
        AddBudgetMovementUseCase,
        { provide: BudgetRepository, useValue: mockBudgetRepo },
        { provide: TransactionRepository, useValue: mockTxRepo },
        { provide: AccountRepository, useValue: mockAccountRepo },
        { provide: CategoryRepository, useValue: mockCategoryRepo },
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

        ...buildPinoLoggerProviders([
          AllExceptionsFilter.name,
          DeleteBudgetUseCase.name,
          AddBudgetMovementUseCase.name,
        ]),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    jwtService = moduleRef.get(JwtService);
    token = jwtService.sign(
      { sub: USER_ID, email: 'user@test.com' },
      { secret: TEST_JWT_SECRET, expiresIn: '15m' },
    );
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    // Default save behavior — return what was saved.
    mockBudgetRepo.save.mockImplementation((b) => Promise.resolve(b));
    mockTxRepo.save.mockImplementation((t) => Promise.resolve(t));
    mockAccountRepo.save.mockImplementation((a) => Promise.resolve(a));
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────────

  it('returns 401 without a token', () =>
    request(app.getHttpServer()).get('/api/v1/budgets').expect(401));

  // ─── POST /budgets ────────────────────────────────────────────────────────────

  describe('POST /api/v1/budgets', () => {
    it('creates a budget and returns it', async () => {
      mockBudgetRepo.findByPeriodAndCurrency.mockResolvedValue(null);
      const res = await request(app.getHttpServer())
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({ year: 2026, month: 4, currency: 'PEN', amount: 2000 })
        .expect(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.year).toBe(2026);
      expect(res.body.data.amount).toBe(2000);
    });

    it('returns 409 when a budget already exists for the same (year, month, currency)', async () => {
      mockBudgetRepo.findByPeriodAndCurrency.mockResolvedValue(makeBudget({ userId: USER_ID }));
      const res = await request(app.getHttpServer())
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({ year: 2026, month: 4, currency: 'PEN', amount: 1000 })
        .expect(409);
      expect(res.body.error.code).toBe('BDGT_002');
    });
  });

  // ─── GET /budgets/current ─────────────────────────────────────────────────────

  describe('GET /api/v1/budgets/current', () => {
    it('returns null when no budget exists for the current month + currency', async () => {
      mockBudgetRepo.findByPeriodAndCurrency.mockResolvedValue(null);
      const res = await request(app.getHttpServer())
        .get('/api/v1/budgets/current')
        .query({ currency: 'PEN' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data).toBeNull();
    });

    it('returns budget + KPI + movements when found', async () => {
      const budget = makeBudget({ id: BUDGET_ID, userId: USER_ID, amount: 1500 });
      mockBudgetRepo.findByPeriodAndCurrency.mockResolvedValue(budget);
      mockTxRepo.findByBudgetId.mockResolvedValue([]);
      mockTxRepo.sumAmountByBudgetId.mockResolvedValue(300);

      const res = await request(app.getHttpServer())
        .get('/api/v1/budgets/current')
        .query({ currency: 'PEN' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.id).toBe(BUDGET_ID);
      expect(res.body.data.spent).toBe(300);
      expect(res.body.data.remaining).toBe(1200);
      expect(res.body.data.movements).toEqual([]);
    });
  });

  // ─── GET /budgets/:id ─────────────────────────────────────────────────────────

  describe('GET /api/v1/budgets/:id', () => {
    it('returns 404 when the budget belongs to another user', async () => {
      mockBudgetRepo.findById.mockResolvedValue(makeBudget({ userId: 'someone-else' }));
      const res = await request(app.getHttpServer())
        .get(`/api/v1/budgets/${BUDGET_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(res.body.error.code).toBe('BDGT_001');
    });
  });

  // ─── POST /budgets/:id/movements ──────────────────────────────────────────────

  describe('POST /api/v1/budgets/:id/movements', () => {
    it('creates an EXPENSE transaction tagged with budgetId and debits the account', async () => {
      const budget = makeBudget({ id: BUDGET_ID, userId: USER_ID, currency: 'PEN' });
      const account = buildAccount({
        id: ACC_PEN,
        userId: USER_ID,
        currency: Currency.PEN,
        balance: 800,
      });
      const category = buildCategory({ id: CAT_ID, userId: USER_ID });
      mockBudgetRepo.findById.mockResolvedValue(budget);
      mockAccountRepo.findById.mockResolvedValue(account);
      mockCategoryRepo.findById.mockResolvedValue(category);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/budgets/${BUDGET_ID}/movements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 50,
          accountId: ACC_PEN,
          categoryId: CAT_ID,
          date: '2026-04-15T12:00:00.000Z',
          description: 'Cena',
        })
        .expect(201);

      expect(res.body.data.transaction.type).toBe('EXPENSE');
      expect(res.body.data.transaction.budgetId).toBe(BUDGET_ID);
      expect(res.body.data.transaction.amount).toBe(50);
      expect(account.balance).toBe(750); // debited
    });

    it('returns 422 CURRENCY_MISMATCH when account currency != budget currency', async () => {
      const budget = makeBudget({ id: BUDGET_ID, userId: USER_ID, currency: 'PEN' });
      const account = buildAccount({ id: ACC_USD, userId: USER_ID, currency: Currency.USD });
      mockBudgetRepo.findById.mockResolvedValue(budget);
      mockAccountRepo.findById.mockResolvedValue(account);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/budgets/${BUDGET_ID}/movements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 50,
          accountId: ACC_USD,
          categoryId: CAT_ID,
          date: '2026-04-15T12:00:00.000Z',
        })
        .expect(422);

      expect(res.body.error.code).toBe('VAL_002');
      expect(mockTxRepo.save).not.toHaveBeenCalled();
    });

    it('returns 422 MOVEMENT_DATE_OUT_OF_RANGE when date is outside the budget month', async () => {
      const budget = makeBudget({ id: BUDGET_ID, userId: USER_ID, year: 2026, month: 4 });
      const account = buildAccount({ id: ACC_PEN, userId: USER_ID, currency: Currency.PEN });
      const category = buildCategory({ id: CAT_ID, userId: USER_ID });
      mockBudgetRepo.findById.mockResolvedValue(budget);
      mockAccountRepo.findById.mockResolvedValue(account);
      mockCategoryRepo.findById.mockResolvedValue(category);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/budgets/${BUDGET_ID}/movements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 50,
          accountId: ACC_PEN,
          categoryId: CAT_ID,
          date: '2026-05-01T12:00:00.000Z',
        })
        .expect(422);

      expect(res.body.error.code).toBe('BDGT_003');
    });
  });

  // ─── DELETE /budgets/:id ──────────────────────────────────────────────────────

  describe('DELETE /api/v1/budgets/:id', () => {
    it('clears budgetId on transactions and soft-deletes the budget (204)', async () => {
      const budget = makeBudget({ id: BUDGET_ID, userId: USER_ID });
      mockBudgetRepo.findById.mockResolvedValue(budget);

      await request(app.getHttpServer())
        .delete(`/api/v1/budgets/${BUDGET_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(mockTxRepo.clearBudgetIdForBudget).toHaveBeenCalledWith(BUDGET_ID);
      expect(mockBudgetRepo.softDelete).toHaveBeenCalledWith(BUDGET_ID);
    });
  });

  // ─── PATCH /budgets/:id ───────────────────────────────────────────────────────

  describe('PATCH /api/v1/budgets/:id', () => {
    it('updates only the amount', async () => {
      const budget = makeBudget({ id: BUDGET_ID, userId: USER_ID, amount: 1000 });
      mockBudgetRepo.findById.mockResolvedValue(budget);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/budgets/${BUDGET_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 2500 })
        .expect(200);

      expect(res.body.data.amount).toBe(2500);
    });
  });
});
