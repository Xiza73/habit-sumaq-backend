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
import { buildHabit } from '../src/modules/habits/domain/__tests__/habit.factory';
import { buildHabitLog } from '../src/modules/habits/domain/__tests__/habit-log.factory';
import { HabitFrequency } from '../src/modules/habits/domain/enums/habit-frequency.enum';
import { HabitRepository } from '../src/modules/habits/domain/habit.repository';
import { HabitLogRepository } from '../src/modules/habits/domain/habit-log.repository';
import { buildQuickTask } from '../src/modules/quick-tasks/domain/__tests__/quick-task.factory';
import { QuickTaskRepository } from '../src/modules/quick-tasks/domain/quick-task.repository';
import { GetFinancesDashboardUseCase } from '../src/modules/reports/application/use-cases/get-finances-dashboard.use-case';
import { GetRoutinesDashboardUseCase } from '../src/modules/reports/application/use-cases/get-routines-dashboard.use-case';
import { ReportsController } from '../src/modules/reports/presentation/reports.controller';
import { TransactionRepository } from '../src/modules/transactions/domain/transaction.repository';
import { buildUserSettings } from '../src/modules/users/domain/__tests__/user-settings.factory';
import { UserSettingsRepository } from '../src/modules/users/domain/user-settings.repository';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-reports-jwt-secret-min-32-chars!';
const USER_ID = 'e2e-user-reports-0001';

describe('ReportsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockAccountRepo: jest.Mocked<AccountRepository> = {
    findByUserId: jest.fn(),
    findByUserIdAndName: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(),
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

  const mockHabitRepo: jest.Mocked<HabitRepository> = {
    findByUserId: jest.fn(),
    findByUserIdAndName: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockHabitLogRepo: jest.Mocked<HabitLogRepository> = {
    findByHabitIdAndDate: jest.fn(),
    findByHabitId: jest.fn(),
    findByUserIdAndDate: jest.fn(),
    findCompletedByHabitIdSince: jest.fn(),
    findByHabitIdAndDateRange: jest.fn(),
    save: jest.fn(),
    softDeleteByHabitId: jest.fn(),
  };

  const mockQuickTaskRepo: jest.Mocked<QuickTaskRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    deleteById: jest.fn(),
    deleteCompletedBefore: jest.fn(),
    maxPositionByUserId: jest.fn(),
    updatePositions: jest.fn(),
  };

  const mockSettingsRepo: jest.Mocked<UserSettingsRepository> = {
    findByUserId: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
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
      controllers: [ReportsController],
      providers: [
        GetFinancesDashboardUseCase,
        GetRoutinesDashboardUseCase,
        { provide: AccountRepository, useValue: mockAccountRepo },
        { provide: TransactionRepository, useValue: mockTxRepo },
        { provide: HabitRepository, useValue: mockHabitRepo },
        { provide: HabitLogRepository, useValue: mockHabitLogRepo },
        { provide: QuickTaskRepository, useValue: mockQuickTaskRepo },
        { provide: UserSettingsRepository, useValue: mockSettingsRepo },

        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },

        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

        ...buildPinoLoggerProviders([AllExceptionsFilter.name]),
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
      { sub: USER_ID, email: 'reports-e2e@test.com' },
      { secret: TEST_JWT_SECRET, expiresIn: '15m' },
    );
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccountRepo.findByUserId.mockResolvedValue([]);
    mockTxRepo.sumFlowByCurrencyInRange.mockResolvedValue([]);
    mockTxRepo.topExpenseCategoriesInRange.mockResolvedValue([]);
    mockTxRepo.dailyNetFlowInRange.mockResolvedValue([]);
    mockTxRepo.aggregateDebtsByReference.mockResolvedValue([]);
    mockHabitRepo.findByUserId.mockResolvedValue([]);
    mockHabitLogRepo.findCompletedByHabitIdSince.mockResolvedValue([]);
    mockHabitLogRepo.findByUserIdAndDate.mockResolvedValue([]);
    mockQuickTaskRepo.findByUserId.mockResolvedValue([]);
    mockSettingsRepo.findByUserId.mockResolvedValue(
      buildUserSettings({ userId: USER_ID, timezone: 'America/Lima' }),
    );
  });

  describe('authentication', () => {
    it('returns 401 without a token for finances-dashboard', () => {
      return request(app.getHttpServer()).get('/api/v1/reports/finances-dashboard').expect(401);
    });

    it('returns 401 without a token for routines-dashboard', () => {
      return request(app.getHttpServer()).get('/api/v1/reports/routines-dashboard').expect(401);
    });
  });

  describe('GET /reports/finances-dashboard', () => {
    it('returns an empty-ish payload for a user with no activity', () => {
      return request(app.getHttpServer())
        .get('/api/v1/reports/finances-dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.period).toBe('month');
          expect(body.data.totalBalance).toEqual([]);
          expect(body.data.periodFlow).toEqual([]);
          expect(body.data.topExpenseCategories).toEqual([]);
          expect(body.data.dailyFlow).toEqual([]);
          expect(body.data.pendingDebts).toEqual([]);
          expect(body.data.range.from).toBeDefined();
          expect(body.data.range.to).toBeDefined();
        });
    });

    it('wires the response shape end-to-end with populated data', () => {
      mockAccountRepo.findByUserId.mockResolvedValue([
        buildAccount({ currency: Currency.PEN, balance: 1000 }),
        buildAccount({ currency: Currency.USD, balance: 500 }),
      ]);
      mockTxRepo.sumFlowByCurrencyInRange.mockResolvedValue([
        { currency: 'PEN', income: 3000, expense: 1800 },
      ]);
      mockTxRepo.topExpenseCategoriesInRange.mockResolvedValue([
        { categoryId: 'c1', name: 'Comida', color: '#f00', currency: 'PEN', total: 800 },
      ]);

      return request(app.getHttpServer())
        .get('/api/v1/reports/finances-dashboard?period=week')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.period).toBe('week');
          expect(body.data.totalBalance).toHaveLength(2);
          expect(body.data.periodFlow[0]).toMatchObject({ currency: 'PEN', net: 1200 });
          expect(body.data.topExpenseCategories[0]).toMatchObject({
            name: 'Comida',
            percentage: 100,
          });
        });
    });

    it('returns 400 on an invalid period value', () => {
      return request(app.getHttpServer())
        .get('/api/v1/reports/finances-dashboard?period=year')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('GET /reports/routines-dashboard', () => {
    it('returns an empty-ish payload for a user with no habits or tasks', () => {
      return request(app.getHttpServer())
        .get('/api/v1/reports/routines-dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.topHabitStreaks).toEqual([]);
          expect(body.data.habitCompletionToday).toEqual({
            completedToday: 0,
            dueToday: 0,
            rate: 0,
          });
          expect(body.data.quickTasksToday).toEqual({ completed: 0, pending: 0, total: 0 });
        });
    });

    it('wires the response shape end-to-end with populated data', () => {
      const habit = buildHabit({ id: 'h1', name: 'Agua', frequency: HabitFrequency.DAILY });
      mockHabitRepo.findByUserId.mockResolvedValue([habit]);
      mockHabitLogRepo.findCompletedByHabitIdSince.mockResolvedValue([
        buildHabitLog({ habitId: 'h1', date: '2026-04-20', completed: true }),
      ]);
      mockHabitLogRepo.findByUserIdAndDate.mockResolvedValue([
        buildHabitLog({ habitId: 'h1', count: 8, completed: true }),
      ]);
      mockQuickTaskRepo.findByUserId.mockResolvedValue([
        buildQuickTask({ id: 't1', completed: true }),
        buildQuickTask({ id: 't2', completed: false }),
      ]);

      return request(app.getHttpServer())
        .get('/api/v1/reports/routines-dashboard?period=30d')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.period).toBe('30d');
          expect(body.data.topHabitStreaks).toHaveLength(1);
          expect(body.data.topHabitStreaks[0]).toMatchObject({ habitId: 'h1', name: 'Agua' });
          expect(body.data.habitCompletionToday).toMatchObject({
            completedToday: 1,
            dueToday: 1,
          });
          expect(body.data.quickTasksToday).toEqual({ completed: 1, pending: 1, total: 2 });
        });
    });
  });
});
