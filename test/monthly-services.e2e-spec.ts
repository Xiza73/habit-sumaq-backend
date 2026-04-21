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
import { buildCategory } from '../src/modules/categories/domain/__tests__/category.factory';
import { CategoryRepository } from '../src/modules/categories/domain/category.repository';
import { ArchiveMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/archive-monthly-service.use-case';
import { CreateMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/create-monthly-service.use-case';
import { DeleteMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/delete-monthly-service.use-case';
import { GetMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/get-monthly-service.use-case';
import { ListMonthlyServicesUseCase } from '../src/modules/monthly-services/application/use-cases/list-monthly-services.use-case';
import { PayMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/pay-monthly-service.use-case';
import { SkipMonthlyServiceMonthUseCase } from '../src/modules/monthly-services/application/use-cases/skip-monthly-service-month.use-case';
import { UpdateMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/update-monthly-service.use-case';
import { buildMonthlyService } from '../src/modules/monthly-services/domain/__tests__/monthly-service.factory';
import { MonthlyServiceRepository } from '../src/modules/monthly-services/domain/monthly-service.repository';
import { MonthlyServicesController } from '../src/modules/monthly-services/presentation/monthly-services.controller';
import { buildTransaction } from '../src/modules/transactions/domain/__tests__/transaction.factory';
import { TransactionType } from '../src/modules/transactions/domain/enums/transaction-type.enum';
import { TransactionRepository } from '../src/modules/transactions/domain/transaction.repository';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-msvc-jwt-secret-min-32-characters!!';
const USER_ID = 'e2e-user-uuid-msvc-0001';
const ACC_ID_1 = '00000000-0000-4000-a000-000000000011';
const ACC_ID_2 = '00000000-0000-4000-a000-000000000012';
const CAT_ID = '00000000-0000-4000-b000-000000000011';
const SVC_ID = '00000000-0000-4000-c000-000000000011';

describe('MonthlyServicesController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockServiceRepo: jest.Mocked<MonthlyServiceRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    findActiveByUserIdAndName: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
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
      controllers: [MonthlyServicesController],
      providers: [
        ListMonthlyServicesUseCase,
        GetMonthlyServiceUseCase,
        CreateMonthlyServiceUseCase,
        UpdateMonthlyServiceUseCase,
        PayMonthlyServiceUseCase,
        SkipMonthlyServiceMonthUseCase,
        ArchiveMonthlyServiceUseCase,
        DeleteMonthlyServiceUseCase,
        { provide: MonthlyServiceRepository, useValue: mockServiceRepo },
        { provide: AccountRepository, useValue: mockAccountRepo },
        { provide: CategoryRepository, useValue: mockCategoryRepo },
        { provide: TransactionRepository, useValue: mockTxRepo },
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

        // PinoLogger tokens required by the use cases that inject @InjectPinoLogger
        ...buildPinoLoggerProviders([
          AllExceptionsFilter.name,
          CreateMonthlyServiceUseCase.name,
          PayMonthlyServiceUseCase.name,
          SkipMonthlyServiceMonthUseCase.name,
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

  beforeEach(() => jest.clearAllMocks());

  // ─── Auth ─────────────────────────────────────────────────────────────────────

  describe('authentication', () => {
    it('should return 401 without a token', () => {
      return request(app.getHttpServer()).get('/api/v1/monthly-services').expect(401);
    });
  });

  // ─── POST /monthly-services ───────────────────────────────────────────────────

  describe('POST /api/v1/monthly-services', () => {
    const minimalBody = {
      name: 'Netflix',
      defaultAccountId: ACC_ID_1,
      categoryId: CAT_ID,
      currency: 'PEN',
    };

    const fullBody = {
      ...minimalBody,
      estimatedAmount: 45,
      dueDay: 15,
      startPeriod: '2026-04',
    };

    it('should create a service using defaults when only the minimal body is sent', async () => {
      mockAccountRepo.findById.mockResolvedValue(
        buildAccount({ id: ACC_ID_1, userId: USER_ID, currency: Currency.PEN }),
      );
      mockCategoryRepo.findById.mockResolvedValue(buildCategory({ id: CAT_ID, userId: USER_ID }));
      mockServiceRepo.findActiveByUserIdAndName.mockResolvedValue(null);
      mockServiceRepo.save.mockImplementation((s) => Promise.resolve(s));

      return request(app.getHttpServer())
        .post('/api/v1/monthly-services')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send(minimalBody)
        .expect(201)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.name).toBe('Netflix');
          expect(body.data.currency).toBe('PEN');
          // Defaults
          expect(body.data.estimatedAmount).toBeNull();
          expect(body.data.dueDay).toBeNull();
          // startPeriod defaults to current month in client TZ
          expect(body.data.startPeriod).toMatch(/^\d{4}-\d{2}$/);
          expect(body.data.lastPaidPeriod).toBeNull();
          expect(body.data.isActive).toBe(true);
        });
    });

    it('should create a service with the full body and return 201', async () => {
      mockAccountRepo.findById.mockResolvedValue(
        buildAccount({ id: ACC_ID_1, userId: USER_ID, currency: Currency.PEN }),
      );
      mockCategoryRepo.findById.mockResolvedValue(buildCategory({ id: CAT_ID, userId: USER_ID }));
      mockServiceRepo.findActiveByUserIdAndName.mockResolvedValue(null);
      mockServiceRepo.save.mockImplementation((s) => Promise.resolve(s));

      return request(app.getHttpServer())
        .post('/api/v1/monthly-services')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send(fullBody)
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.name).toBe('Netflix');
          expect(body.data.estimatedAmount).toBe(45);
          expect(body.data.dueDay).toBe(15);
          expect(body.data.startPeriod).toBe('2026-04');
        });
    });

    it('should return 409 MSVC_003 when an active service with the same name already exists', async () => {
      mockAccountRepo.findById.mockResolvedValue(
        buildAccount({ id: ACC_ID_1, userId: USER_ID, currency: Currency.PEN }),
      );
      mockCategoryRepo.findById.mockResolvedValue(buildCategory({ id: CAT_ID, userId: USER_ID }));
      mockServiceRepo.findActiveByUserIdAndName.mockResolvedValue(
        buildMonthlyService({ userId: USER_ID, name: 'Netflix' }),
      );

      return request(app.getHttpServer())
        .post('/api/v1/monthly-services')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send(fullBody)
        .expect(409)
        .expect(({ body }) => {
          expect(body.success).toBe(false);
          expect(body.error.code).toBe('MSVC_003');
        });
    });

    it('should return 400 when name is empty (class-validator)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/monthly-services')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ ...fullBody, name: '' })
        .expect(400);
    });

    it('should return 400 when currency is not a 3-letter code', () => {
      return request(app.getHttpServer())
        .post('/api/v1/monthly-services')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ ...fullBody, currency: 'PE' })
        .expect(400);
    });
  });

  // ─── GET /monthly-services ────────────────────────────────────────────────────

  describe('GET /api/v1/monthly-services', () => {
    it('should return 200 with an empty list when the user has no services', async () => {
      mockServiceRepo.findByUserId.mockResolvedValue([]);

      return request(app.getHttpServer())
        .get('/api/v1/monthly-services')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toEqual([]);
        });
    });

    it('should hide archived services by default and include them with ?includeArchived=true', async () => {
      const active = buildMonthlyService({
        userId: USER_ID,
        name: 'Netflix',
        isActive: true,
        startPeriod: '2026-04',
        lastPaidPeriod: null,
      });
      const archived = buildMonthlyService({
        userId: USER_ID,
        name: 'Spotify Archivado',
        isActive: false,
      });

      // Default call (includeArchived=false) — repo returns only active
      mockServiceRepo.findByUserId.mockResolvedValueOnce([active]);

      await request(app.getHttpServer())
        .get('/api/v1/monthly-services')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(1);
          expect(body.data[0].name).toBe('Netflix');
        });
      expect(mockServiceRepo.findByUserId).toHaveBeenLastCalledWith(USER_ID, false);

      // includeArchived=true — repo returns both
      mockServiceRepo.findByUserId.mockResolvedValueOnce([active, archived]);

      await request(app.getHttpServer())
        .get('/api/v1/monthly-services?includeArchived=true')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          const items = body.data as Array<{ name: string }>;
          expect(items).toHaveLength(2);
          expect(items.map((s) => s.name)).toContain('Spotify Archivado');
        });
      expect(mockServiceRepo.findByUserId).toHaveBeenLastCalledWith(USER_ID, true);
    });

    it('should derive nextDuePeriod, isOverdue and isPaidForCurrentMonth from the client TZ', async () => {
      // Fix system time so the "current period" is deterministic.
      jest.useFakeTimers().setSystemTime(new Date('2026-04-21T12:00:00Z'));

      // Service never paid, startPeriod == 2026-03 — should be OVERDUE (due < current).
      const overdue = buildMonthlyService({
        userId: USER_ID,
        name: 'OverdueSvc',
        startPeriod: '2026-03',
        lastPaidPeriod: null,
      });
      // Already paid for April — nextDuePeriod == 2026-05 (> current), isPaidForCurrentMonth=true.
      const paidThisMonth = buildMonthlyService({
        userId: USER_ID,
        name: 'PaidSvc',
        startPeriod: '2026-01',
        lastPaidPeriod: '2026-04',
      });
      mockServiceRepo.findByUserId.mockResolvedValue([overdue, paidThisMonth]);

      try {
        await request(app.getHttpServer())
          .get('/api/v1/monthly-services')
          .set('Authorization', `Bearer ${token}`)
          .set('x-timezone', 'America/Lima')
          .expect(200)
          .expect(({ body }) => {
            const [first, second] = body.data as Array<{
              name: string;
              nextDuePeriod: string;
              isOverdue: boolean;
              isPaidForCurrentMonth: boolean;
            }>;
            expect(first.name).toBe('OverdueSvc');
            expect(first.nextDuePeriod).toBe('2026-03');
            expect(first.isOverdue).toBe(true);
            expect(first.isPaidForCurrentMonth).toBe(false);

            expect(second.name).toBe('PaidSvc');
            expect(second.nextDuePeriod).toBe('2026-05');
            expect(second.isOverdue).toBe(false);
            expect(second.isPaidForCurrentMonth).toBe(true);
          });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // ─── GET /monthly-services/:id ────────────────────────────────────────────────

  describe('GET /api/v1/monthly-services/:id', () => {
    it('should return 200 with the service when it belongs to the user', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, name: 'Netflix' });
      mockServiceRepo.findById.mockResolvedValue(service);

      return request(app.getHttpServer())
        .get(`/api/v1/monthly-services/${SVC_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.id).toBe(SVC_ID);
          expect(body.data.name).toBe('Netflix');
        });
    });

    it('should return 404 MSVC_002 when the service does not exist', async () => {
      mockServiceRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get(`/api/v1/monthly-services/${SVC_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSVC_002');
        });
    });

    it('should return 404 MSVC_002 when the service belongs to another user', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: 'other-user' });
      mockServiceRepo.findById.mockResolvedValue(service);

      return request(app.getHttpServer())
        .get(`/api/v1/monthly-services/${SVC_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSVC_002');
        });
    });
  });

  // ─── PATCH /monthly-services/:id ──────────────────────────────────────────────

  describe('PATCH /api/v1/monthly-services/:id', () => {
    it('should update name + dueDay + estimatedAmount and return 200', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, name: 'Old' });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockServiceRepo.findActiveByUserIdAndName.mockResolvedValue(null);
      mockServiceRepo.save.mockImplementation((s) => Promise.resolve(s));

      return request(app.getHttpServer())
        .patch(`/api/v1/monthly-services/${SVC_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ name: 'New', dueDay: 10, estimatedAmount: 99 })
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.name).toBe('New');
          expect(body.data.dueDay).toBe(10);
          expect(body.data.estimatedAmount).toBe(99);
        });
    });

    it('should return 400 when currency is sent (immutable, rejected by whitelist)', async () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/monthly-services/${SVC_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ currency: 'USD' })
        .expect(400);
    });

    it('should return 400 when startPeriod is sent (immutable, rejected by whitelist)', async () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/monthly-services/${SVC_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ startPeriod: '2026-09' })
        .expect(400);
    });

    it('should return 404 MSVC_002 when the service does not exist', async () => {
      mockServiceRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .patch(`/api/v1/monthly-services/${SVC_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ name: 'NewName' })
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSVC_002');
        });
    });
  });

  // ─── POST /monthly-services/:id/pay ──────────────────────────────────────────

  describe('POST /api/v1/monthly-services/:id/pay', () => {
    it('should create an EXPENSE tx, advance lastPaidPeriod, debit the default account and return 201', async () => {
      const service = buildMonthlyService({
        id: SVC_ID,
        userId: USER_ID,
        currency: 'PEN',
        startPeriod: '2026-04',
        lastPaidPeriod: null,
        defaultAccountId: ACC_ID_1,
        estimatedAmount: null,
      });
      const account = buildAccount({
        id: ACC_ID_1,
        userId: USER_ID,
        currency: Currency.PEN,
        balance: 500,
      });

      mockServiceRepo.findById.mockResolvedValue(service);
      mockAccountRepo.findById.mockResolvedValue(account);
      mockAccountRepo.save.mockImplementation((a) => Promise.resolve(a));
      mockServiceRepo.save.mockImplementation((s) => Promise.resolve(s));
      mockTxRepo.save.mockImplementation((tx) => Promise.resolve(tx));
      // After the first payment the recompute query returns [the new tx] — AVG(42) = 42.
      mockTxRepo.findLastNByMonthlyServiceId.mockResolvedValue([
        buildTransaction({ amount: 42, userId: USER_ID, monthlyServiceId: SVC_ID }),
      ]);

      return request(app.getHttpServer())
        .post(`/api/v1/monthly-services/${SVC_ID}/pay`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ amount: 42 })
        .expect(201)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          // Response shape: { service, transaction }
          expect(body.data.transaction.type).toBe(TransactionType.EXPENSE);
          expect(body.data.transaction.amount).toBe(42);
          expect(body.data.transaction.accountId).toBe(ACC_ID_1);
          expect(body.data.transaction.monthlyServiceId).toBe(SVC_ID);
          expect(body.data.service.lastPaidPeriod).toBe('2026-04');
          // estimatedAmount got recomputed from the moving-average query result.
          expect(body.data.service.estimatedAmount).toBe(42);
          // Account was debited by the paid amount.
          expect(account.balance).toBe(458);
        });
    });

    it('should use accountIdOverride when provided instead of the default account', async () => {
      const service = buildMonthlyService({
        id: SVC_ID,
        userId: USER_ID,
        currency: 'PEN',
        defaultAccountId: ACC_ID_1,
        lastPaidPeriod: '2026-03',
      });
      const override = buildAccount({
        id: ACC_ID_2,
        userId: USER_ID,
        currency: Currency.PEN,
        balance: 1000,
      });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockAccountRepo.findById.mockImplementation((id) =>
        id === ACC_ID_2 ? Promise.resolve(override) : Promise.resolve(null),
      );
      mockAccountRepo.save.mockImplementation((a) => Promise.resolve(a));
      mockServiceRepo.save.mockImplementation((s) => Promise.resolve(s));
      mockTxRepo.save.mockImplementation((tx) => Promise.resolve(tx));
      mockTxRepo.findLastNByMonthlyServiceId.mockResolvedValue([]);

      return request(app.getHttpServer())
        .post(`/api/v1/monthly-services/${SVC_ID}/pay`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ amount: 20, accountIdOverride: ACC_ID_2 })
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.transaction.accountId).toBe(ACC_ID_2);
          expect(override.balance).toBe(980);
        });
    });

    it('should return 404 MSVC_002 when the service does not exist', async () => {
      mockServiceRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post(`/api/v1/monthly-services/${SVC_ID}/pay`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ amount: 42 })
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSVC_002');
        });
    });
  });

  // ─── POST /monthly-services/:id/skip ─────────────────────────────────────────

  describe('POST /api/v1/monthly-services/:id/skip', () => {
    it('should advance lastPaidPeriod WITHOUT creating a transaction and return 200', async () => {
      const service = buildMonthlyService({
        id: SVC_ID,
        userId: USER_ID,
        startPeriod: '2026-04',
        lastPaidPeriod: null,
      });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockServiceRepo.save.mockImplementation((s) => Promise.resolve(s));

      await request(app.getHttpServer())
        .post(`/api/v1/monthly-services/${SVC_ID}/skip`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ reason: 'Mes gratis' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.lastPaidPeriod).toBe('2026-04');
        });

      // Key invariant: skip NEVER creates a transaction.
      expect(mockTxRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── PATCH /monthly-services/:id/archive ─────────────────────────────────────

  describe('PATCH /api/v1/monthly-services/:id/archive', () => {
    it('should toggle isActive true -> false -> true across consecutive calls', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, isActive: true });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockServiceRepo.save.mockImplementation((s) => Promise.resolve(s));

      // 1st call: true -> false
      await request(app.getHttpServer())
        .patch(`/api/v1/monthly-services/${SVC_ID}/archive`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.isActive).toBe(false);
        });

      // 2nd call: false -> true (same in-memory service instance keeps state).
      await request(app.getHttpServer())
        .patch(`/api/v1/monthly-services/${SVC_ID}/archive`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.isActive).toBe(true);
        });
    });
  });

  // ─── DELETE /monthly-services/:id ────────────────────────────────────────────

  describe('DELETE /api/v1/monthly-services/:id', () => {
    it('should soft-delete the service when it has no linked transactions and return 204', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockTxRepo.countByMonthlyServiceId.mockResolvedValue(0);
      mockServiceRepo.softDelete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/v1/monthly-services/${SVC_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(mockServiceRepo.softDelete).toHaveBeenCalledWith(SVC_ID);
      // The in-memory repo relies on TypeORM's @DeleteDateColumn to hide
      // soft-deleted rows from subsequent find()/findOne() queries — we
      // simulate that here by returning null on the next findById.
      mockServiceRepo.findById.mockResolvedValue(null);
      mockServiceRepo.findByUserId.mockResolvedValue([]);
      await request(app.getHttpServer())
        .get('/api/v1/monthly-services')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toEqual([]);
        });
    });

    it('should return 409 MSVC_001 when the service has registered payments', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockTxRepo.countByMonthlyServiceId.mockResolvedValue(3);

      return request(app.getHttpServer())
        .delete(`/api/v1/monthly-services/${SVC_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409)
        .expect(({ body }) => {
          expect(body.success).toBe(false);
          expect(body.error.code).toBe('MSVC_001');
        });
    });
  });
});
