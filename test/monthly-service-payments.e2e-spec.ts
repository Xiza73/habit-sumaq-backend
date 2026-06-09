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
import { CurrencyPoolService } from '../src/modules/currency-pools/application/currency-pool.service';
import { CreateMonthlyServicePaymentUseCase } from '../src/modules/monthly-service-payments/application/use-cases/create-monthly-service-payment.use-case';
import { DeleteMonthlyServicePaymentUseCase } from '../src/modules/monthly-service-payments/application/use-cases/delete-monthly-service-payment.use-case';
import { GetMonthlyServicePaymentUseCase } from '../src/modules/monthly-service-payments/application/use-cases/get-monthly-service-payment.use-case';
import { ListMonthlyServicePaymentsUseCase } from '../src/modules/monthly-service-payments/application/use-cases/list-monthly-service-payments.use-case';
import { UpdateMonthlyServicePaymentUseCase } from '../src/modules/monthly-service-payments/application/use-cases/update-monthly-service-payment.use-case';
import { buildMonthlyServicePayment } from '../src/modules/monthly-service-payments/domain/__tests__/monthly-service-payment.factory';
import { MonthlyServicePaymentRepository } from '../src/modules/monthly-service-payments/domain/monthly-service-payment.repository';
import { MonthlyServicePaymentsController } from '../src/modules/monthly-service-payments/presentation/monthly-service-payments.controller';
import { buildMonthlyService } from '../src/modules/monthly-services/domain/__tests__/monthly-service.factory';
import { MonthlyServiceRepository } from '../src/modules/monthly-services/domain/monthly-service.repository';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-msp-jwt-secret-min-32-chars-defin';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const SERVICE_ID = '00000000-0000-4000-9000-000000000030';
const PAYMENT_ID = '00000000-0000-4000-9000-000000000031';

describe('MonthlyServicePaymentsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockRepo: jest.Mocked<MonthlyServicePaymentRepository> = {
    findByServiceId: jest.fn(),
    findById: jest.fn(),
    findByServiceAndPeriod: jest.fn(),
    sumByCurrencyInRange: jest.fn(),
    save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    softDelete: jest.fn(),
  };

  const mockServiceRepo: jest.Mocked<MonthlyServiceRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    findActiveByUserIdAndName: jest.fn(),
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
      controllers: [MonthlyServicePaymentsController],
      providers: [
        ListMonthlyServicePaymentsUseCase,
        GetMonthlyServicePaymentUseCase,
        CreateMonthlyServicePaymentUseCase,
        UpdateMonthlyServicePaymentUseCase,
        DeleteMonthlyServicePaymentUseCase,
        { provide: MonthlyServicePaymentRepository, useValue: mockRepo },
        { provide: MonthlyServiceRepository, useValue: mockServiceRepo },
        { provide: CurrencyPoolService, useValue: mockPool },
        { provide: DataSource, useValue: mockDataSource },
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
        ...buildPinoLoggerProviders([
          AllExceptionsFilter.name,
          CreateMonthlyServicePaymentUseCase.name,
          UpdateMonthlyServicePaymentUseCase.name,
          DeleteMonthlyServicePaymentUseCase.name,
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
    mockRepo.save.mockImplementation((p) => Promise.resolve(p));
  });

  describe('authentication', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/monthly-service-payments?monthlyServiceId=${SERVICE_ID}`)
        .expect(401);
    });
  });

  describe('GET /api/v1/monthly-service-payments?monthlyServiceId=...', () => {
    it('lists payments for an owned service', async () => {
      mockServiceRepo.findById.mockResolvedValueOnce(
        buildMonthlyService({ id: SERVICE_ID, userId: USER_ID }),
      );
      mockRepo.findByServiceId.mockResolvedValueOnce([
        buildMonthlyServicePayment({
          id: PAYMENT_ID,
          userId: USER_ID,
          monthlyServiceId: SERVICE_ID,
        }),
      ]);

      return request(app.getHttpServer())
        .get(`/api/v1/monthly-service-payments?monthlyServiceId=${SERVICE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toHaveLength(1);
          expect(body.data[0].monthlyServiceId).toBe(SERVICE_ID);
        });
    });

    it('returns MSP_002 when the service belongs to someone else', () => {
      mockServiceRepo.findById.mockResolvedValueOnce(
        buildMonthlyService({ id: SERVICE_ID, userId: 'other-user' }),
      );
      return request(app.getHttpServer())
        .get(`/api/v1/monthly-service-payments?monthlyServiceId=${SERVICE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe('MSP_002'));
    });
  });

  describe('POST /api/v1/monthly-service-payments', () => {
    it('creates a payment and debits the pool', async () => {
      mockServiceRepo.findById.mockResolvedValueOnce(
        buildMonthlyService({ id: SERVICE_ID, userId: USER_ID, currency: Currency.PEN }),
      );
      mockRepo.findByServiceAndPeriod.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .post('/api/v1/monthly-service-payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          monthlyServiceId: SERVICE_ID,
          period: '2026-06',
          amount: 50,
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.amount).toBe(50);
          expect(body.data.period).toBe('2026-06');
          expect(body.data.currency).toBe('PEN');
        });

      expect(mockPool.applyDelta).toHaveBeenCalledWith(USER_ID, Currency.PEN, -50, fakeManager);
    });

    it('returns MSP_003 when a payment already exists for the same (service, period)', async () => {
      mockServiceRepo.findById.mockResolvedValueOnce(
        buildMonthlyService({ id: SERVICE_ID, userId: USER_ID }),
      );
      mockRepo.findByServiceAndPeriod.mockResolvedValueOnce(
        buildMonthlyServicePayment({ monthlyServiceId: SERVICE_ID, period: '2026-06' }),
      );

      return request(app.getHttpServer())
        .post('/api/v1/monthly-service-payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          monthlyServiceId: SERVICE_ID,
          period: '2026-06',
          amount: 50,
        })
        .expect(409)
        .expect(({ body }) => expect(body.error.code).toBe('MSP_003'));
    });

    it('returns 400 from class-validator when period is malformed (caught BEFORE the use case)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/monthly-service-payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          monthlyServiceId: SERVICE_ID,
          period: '2026-13',
          amount: 50,
        })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/monthly-service-payments/:id', () => {
    it('amount UP debits the pool by the diff', async () => {
      mockRepo.findById.mockResolvedValueOnce(
        buildMonthlyServicePayment({
          id: PAYMENT_ID,
          userId: USER_ID,
          amount: 50,
          currency: Currency.PEN,
        }),
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/monthly-service-payments/${PAYMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 80 })
        .expect(200);

      // oldAmount(50) - newAmount(80) = -30
      expect(mockPool.applyDelta).toHaveBeenCalledWith(USER_ID, Currency.PEN, -30, fakeManager);
    });

    it('amount unchanged → no pool, no tx wrapper', async () => {
      mockRepo.findById.mockResolvedValueOnce(
        buildMonthlyServicePayment({ userId: USER_ID, amount: 50 }),
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/monthly-service-payments/${PAYMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'updated' })
        .expect(200);

      expect(mockPool.applyDelta).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/monthly-service-payments/:id', () => {
    it('soft-deletes and refunds the pool (204)', async () => {
      mockRepo.findById.mockResolvedValueOnce(
        buildMonthlyServicePayment({
          id: PAYMENT_ID,
          userId: USER_ID,
          amount: 45,
          currency: Currency.PEN,
        }),
      );

      await request(app.getHttpServer())
        .delete(`/api/v1/monthly-service-payments/${PAYMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(mockRepo.softDelete).toHaveBeenCalledWith(PAYMENT_ID, fakeManager);
      expect(mockPool.applyDelta).toHaveBeenCalledWith(USER_ID, Currency.PEN, 45, fakeManager);
    });

    it('returns MSP_001 when not found', () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      return request(app.getHttpServer())
        .delete(`/api/v1/monthly-service-payments/${PAYMENT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404)
        .expect(({ body }) => expect(body.error.code).toBe('MSP_001'));
    });
  });
});
