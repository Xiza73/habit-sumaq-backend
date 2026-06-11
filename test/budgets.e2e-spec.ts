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
import { JwtAccessStrategy } from '../src/modules/auth/infrastructure/strategies/jwt-access.strategy';
import { BudgetMovementRepository } from '../src/modules/budget-movements/domain/budget-movement.repository';
import { CreateBudgetUseCase } from '../src/modules/budgets/application/use-cases/create-budget.use-case';
import { DeleteBudgetUseCase } from '../src/modules/budgets/application/use-cases/delete-budget.use-case';
import { GetBudgetUseCase } from '../src/modules/budgets/application/use-cases/get-budget.use-case';
import { GetCurrentBudgetUseCase } from '../src/modules/budgets/application/use-cases/get-current-budget.use-case';
import { ListBudgetsUseCase } from '../src/modules/budgets/application/use-cases/list-budgets.use-case';
import { UpdateBudgetUseCase } from '../src/modules/budgets/application/use-cases/update-budget.use-case';
import { makeBudget } from '../src/modules/budgets/domain/__tests__/budget.factory';
import { BudgetRepository } from '../src/modules/budgets/domain/budget.repository';
import { BudgetsController } from '../src/modules/budgets/presentation/budgets.controller';
import { CategoryRepository } from '../src/modules/categories/domain/category.repository';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-budgets-jwt-secret-min-32-characters!!';
const USER_ID = 'e2e-user-uuid-bdgt-0001';
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

  // v1.0.0: GetCurrentBudgetUseCase + GetBudgetUseCase read movements +
  // spent from the budget_movements module.
  const mockBudgetMovementRepo: jest.Mocked<BudgetMovementRepository> = {
    findByBudgetId: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    sumByBudgetId: jest.fn().mockResolvedValue(0),
    sumByCurrencyInRange: jest.fn(),
    topCategoriesByCurrencyInRange: jest.fn(),
    dailyByCurrencyInRange: jest.fn(),
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
        { provide: BudgetRepository, useValue: mockBudgetRepo },
        { provide: BudgetMovementRepository, useValue: mockBudgetMovementRepo },
        { provide: CategoryRepository, useValue: mockCategoryRepo },
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

        ...buildPinoLoggerProviders([AllExceptionsFilter.name, DeleteBudgetUseCase.name]),
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
    mockBudgetRepo.save.mockImplementation((b) => Promise.resolve(b));
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
      // v1.0.0: movements + spent come from `budget_movements`, not `txRepo`.
      mockBudgetMovementRepo.findByBudgetId.mockResolvedValue([]);
      mockBudgetMovementRepo.sumByBudgetId.mockResolvedValue(300);

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

  // ─── DELETE /budgets/:id ──────────────────────────────────────────────────────
  // v1.0.0 (A6-B): the `POST /budgets/:id/movements` endpoint is gone —
  // the web uses `POST /budget-movements` directly. Delete no longer
  // nullifies tx.budgetId (the transactions module is gone too).

  describe('DELETE /api/v1/budgets/:id', () => {
    it('soft-deletes the budget (204)', async () => {
      const budget = makeBudget({ id: BUDGET_ID, userId: USER_ID });
      mockBudgetRepo.findById.mockResolvedValue(budget);

      await request(app.getHttpServer())
        .delete(`/api/v1/budgets/${BUDGET_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

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
