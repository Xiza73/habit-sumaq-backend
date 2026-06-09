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
import { DataSource, type EntityManager } from 'typeorm';

import { Currency } from '../src/common/enums/currency.enum';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';
import { JwtAccessStrategy } from '../src/modules/auth/infrastructure/strategies/jwt-access.strategy';
import { CreateBudgetMovementUseCase } from '../src/modules/budget-movements/application/use-cases/create-budget-movement.use-case';
import { DeleteBudgetMovementUseCase } from '../src/modules/budget-movements/application/use-cases/delete-budget-movement.use-case';
import { GetBudgetMovementUseCase } from '../src/modules/budget-movements/application/use-cases/get-budget-movement.use-case';
import { ListBudgetMovementsUseCase } from '../src/modules/budget-movements/application/use-cases/list-budget-movements.use-case';
import { UpdateBudgetMovementUseCase } from '../src/modules/budget-movements/application/use-cases/update-budget-movement.use-case';
import { buildBudgetMovement } from '../src/modules/budget-movements/domain/__tests__/budget-movement.factory';
import { BudgetMovementRepository } from '../src/modules/budget-movements/domain/budget-movement.repository';
import { BudgetMovementsController } from '../src/modules/budget-movements/presentation/budget-movements.controller';
import { makeBudget } from '../src/modules/budgets/domain/__tests__/budget.factory';
import { BudgetRepository } from '../src/modules/budgets/domain/budget.repository';
import { CurrencyPoolService } from '../src/modules/currency-pools/application/currency-pool.service';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-budget-movements-jwt-secret-min-32-chars';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const BUDGET_ID = '00000000-0000-4000-9000-000000000020';
const MOVEMENT_ID = '00000000-0000-4000-9000-000000000021';

describe('BudgetMovementsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockRepo: jest.Mocked<BudgetMovementRepository> = {
    findByBudgetId: jest.fn(),
    findById: jest.fn(),
    sumByBudgetId: jest.fn(),
    save: jest.fn().mockImplementation((m) => Promise.resolve(m)),
    softDelete: jest.fn(),
  };

  const mockBudgetRepo: jest.Mocked<BudgetRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    findByPeriodAndCurrency: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockPool = {
    applyDelta: jest.fn(),
  } as unknown as jest.Mocked<CurrencyPoolService>;

  const fakeManager = { tx: true } as unknown as EntityManager;
  const mockDataSource = {
    transaction: jest
      .fn()
      .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(fakeManager)),
  } as unknown as DataSource;

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
      controllers: [BudgetMovementsController],
      providers: [
        ListBudgetMovementsUseCase,
        GetBudgetMovementUseCase,
        CreateBudgetMovementUseCase,
        UpdateBudgetMovementUseCase,
        DeleteBudgetMovementUseCase,
        { provide: BudgetMovementRepository, useValue: mockRepo },
        { provide: BudgetRepository, useValue: mockBudgetRepo },
        { provide: CurrencyPoolService, useValue: mockPool },
        { provide: DataSource, useValue: mockDataSource },
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
        ...buildPinoLoggerProviders([
          AllExceptionsFilter.name,
          CreateBudgetMovementUseCase.name,
          UpdateBudgetMovementUseCase.name,
          DeleteBudgetMovementUseCase.name,
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
    mockRepo.save.mockImplementation((m) => Promise.resolve(m));
  });

  describe('authentication', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/budget-movements?budgetId=${BUDGET_ID}`)
        .expect(401);
    });
  });

  describe('GET /api/v1/budget-movements?budgetId=...', () => {
    it('lists movements for an owned budget', async () => {
      mockBudgetRepo.findById.mockResolvedValueOnce(makeBudget({ id: BUDGET_ID, userId: USER_ID }));
      mockRepo.findByBudgetId.mockResolvedValueOnce([
        buildBudgetMovement({ id: MOVEMENT_ID, userId: USER_ID, budgetId: BUDGET_ID }),
      ]);

      return request(app.getHttpServer())
        .get(`/api/v1/budget-movements?budgetId=${BUDGET_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toHaveLength(1);
          expect(body.data[0].budgetId).toBe(BUDGET_ID);
        });
    });

    it('returns BMV_002 when the budget belongs to someone else', () => {
      mockBudgetRepo.findById.mockResolvedValueOnce(
        makeBudget({ id: BUDGET_ID, userId: 'other-user' }),
      );
      return request(app.getHttpServer())
        .get(`/api/v1/budget-movements?budgetId=${BUDGET_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe('BMV_002'));
    });
  });

  describe('POST /api/v1/budget-movements', () => {
    it('creates a movement and debits the pool by amount', async () => {
      const budget = makeBudget({
        id: BUDGET_ID,
        userId: USER_ID,
        year: 2026,
        month: 6,
        currency: Currency.PEN,
      });
      mockBudgetRepo.findById.mockResolvedValueOnce(budget);

      await request(app.getHttpServer())
        .post('/api/v1/budget-movements')
        .set('Authorization', `Bearer ${token}`)
        .send({
          budgetId: BUDGET_ID,
          amount: 75.5,
          date: '2026-06-15T12:00:00.000Z',
          description: 'Cena',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.amount).toBe(75.5);
          expect(body.data.currency).toBe('PEN');
          expect(body.data.budgetId).toBe(BUDGET_ID);
        });

      expect(mockPool.applyDelta).toHaveBeenCalledWith(USER_ID, Currency.PEN, -75.5, fakeManager);
    });

    it('returns BMV_003 when the date is outside the budget month', async () => {
      mockBudgetRepo.findById.mockResolvedValueOnce(
        makeBudget({ id: BUDGET_ID, userId: USER_ID, year: 2026, month: 6 }),
      );
      return request(app.getHttpServer())
        .post('/api/v1/budget-movements')
        .set('Authorization', `Bearer ${token}`)
        .send({
          budgetId: BUDGET_ID,
          amount: 30,
          date: '2026-07-01T00:00:00.000Z',
        })
        .expect(422)
        .expect(({ body }) => expect(body.error.code).toBe('BMV_003'));
    });
  });

  describe('PATCH /api/v1/budget-movements/:id', () => {
    it('amount UP debits the pool by the difference', async () => {
      mockRepo.findById.mockResolvedValueOnce(
        buildBudgetMovement({
          id: MOVEMENT_ID,
          userId: USER_ID,
          budgetId: BUDGET_ID,
          amount: 100,
          currency: Currency.PEN,
        }),
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/budget-movements/${MOVEMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 130 })
        .expect(200);

      // oldAmount(100) - newAmount(130) = -30
      expect(mockPool.applyDelta).toHaveBeenCalledWith(USER_ID, Currency.PEN, -30, fakeManager);
    });

    it('amount unchanged → no pool call, no tx wrapper', async () => {
      mockRepo.findById.mockResolvedValueOnce(
        buildBudgetMovement({ userId: USER_ID, amount: 100 }),
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/budget-movements/${MOVEMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'updated' })
        .expect(200);

      expect(mockPool.applyDelta).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/budget-movements/:id', () => {
    it('soft-deletes and refunds the pool (204)', async () => {
      mockRepo.findById.mockResolvedValueOnce(
        buildBudgetMovement({
          id: MOVEMENT_ID,
          userId: USER_ID,
          amount: 50,
          currency: Currency.PEN,
        }),
      );

      await request(app.getHttpServer())
        .delete(`/api/v1/budget-movements/${MOVEMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(mockRepo.softDelete).toHaveBeenCalledWith(MOVEMENT_ID, fakeManager);
      expect(mockPool.applyDelta).toHaveBeenCalledWith(USER_ID, Currency.PEN, 50, fakeManager);
    });

    it('returns BMV_001 when not found', () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      return request(app.getHttpServer())
        .delete(`/api/v1/budget-movements/${MOVEMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404)
        .expect(({ body }) => expect(body.error.code).toBe('BMV_001'));
    });
  });
});
