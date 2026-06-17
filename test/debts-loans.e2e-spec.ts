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
import { BulkSettleByReferenceUseCase } from '../src/modules/debts-loans/application/use-cases/bulk-settle-by-reference.use-case';
import { CreateDebtLoanUseCase } from '../src/modules/debts-loans/application/use-cases/create-debt-loan.use-case';
import { DeleteDebtLoanUseCase } from '../src/modules/debts-loans/application/use-cases/delete-debt-loan.use-case';
import { GetDebtLoanUseCase } from '../src/modules/debts-loans/application/use-cases/get-debt-loan.use-case';
import { GetDebtsSummaryUseCase } from '../src/modules/debts-loans/application/use-cases/get-debts-summary.use-case';
import { ListDebtLoanPaymentsUseCase } from '../src/modules/debts-loans/application/use-cases/list-debt-loan-payments.use-case';
import { ListDebtsLoansUseCase } from '../src/modules/debts-loans/application/use-cases/list-debts-loans.use-case';
import { SettleDebtLoanUseCase } from '../src/modules/debts-loans/application/use-cases/settle-debt-loan.use-case';
import { UpdateDebtLoanUseCase } from '../src/modules/debts-loans/application/use-cases/update-debt-loan.use-case';
import { buildDebtLoan } from '../src/modules/debts-loans/domain/__tests__/debt-loan.factory';
import { DebtLoanRepository } from '../src/modules/debts-loans/domain/debt-loan.repository';
import { DebtLoanPaymentRepository } from '../src/modules/debts-loans/domain/debt-loan-payment.repository';
import { DebtLoanStatus } from '../src/modules/debts-loans/domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../src/modules/debts-loans/domain/enums/debt-loan-type.enum';
import { DebtsLoansController } from '../src/modules/debts-loans/presentation/debts-loans.controller';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-debts-loans-jwt-secret-min-32-chars-!';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const DEBT_ID = '00000000-0000-4000-9000-000000000010';

describe('DebtsLoansController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockRepo: jest.Mocked<DebtLoanRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    aggregateByReference: jest.fn(),
    findPendingByNormalizedReference: jest.fn(),
    save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
    softDelete: jest.fn(),
  };

  const mockPaymentRepo: jest.Mocked<DebtLoanPaymentRepository> = {
    create: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    findByDebtLoanId: jest.fn().mockResolvedValue([]),
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
      controllers: [DebtsLoansController],
      providers: [
        ListDebtsLoansUseCase,
        GetDebtLoanUseCase,
        GetDebtsSummaryUseCase,
        CreateDebtLoanUseCase,
        UpdateDebtLoanUseCase,
        DeleteDebtLoanUseCase,
        SettleDebtLoanUseCase,
        BulkSettleByReferenceUseCase,
        ListDebtLoanPaymentsUseCase,
        { provide: DebtLoanRepository, useValue: mockRepo },
        { provide: DebtLoanPaymentRepository, useValue: mockPaymentRepo },
        { provide: CurrencyPoolService, useValue: mockPool },
        { provide: DataSource, useValue: mockDataSource },
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
        ...buildPinoLoggerProviders([
          AllExceptionsFilter.name,
          CreateDebtLoanUseCase.name,
          DeleteDebtLoanUseCase.name,
          SettleDebtLoanUseCase.name,
          BulkSettleByReferenceUseCase.name,
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
    mockRepo.save.mockImplementation((d) => Promise.resolve(d));
    mockPaymentRepo.create.mockImplementation((p) => Promise.resolve(p));
    mockPaymentRepo.findByDebtLoanId.mockResolvedValue([]);
  });

  describe('authentication', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).get('/api/v1/debts').expect(401);
    });
  });

  describe('GET /api/v1/debts', () => {
    it('returns 200 with the list mapped through DebtLoanResponseDto', async () => {
      mockRepo.findByUserId.mockResolvedValue([buildDebtLoan({ id: DEBT_ID, userId: USER_ID })]);

      return request(app.getHttpServer())
        .get('/api/v1/debts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toHaveLength(1);
          expect(body.data[0].id).toBe(DEBT_ID);
          expect(body.data[0].status).toBe('PENDING');
        });
    });

    it('forwards status=settled to the repo', async () => {
      mockRepo.findByUserId.mockResolvedValue([]);
      await request(app.getHttpServer())
        .get('/api/v1/debts?status=settled')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(mockRepo.findByUserId).toHaveBeenCalledWith(USER_ID, 'settled');
    });
  });

  describe('GET /api/v1/debts/summary', () => {
    it('returns the aggregated rows', () => {
      mockRepo.aggregateByReference.mockResolvedValue([
        {
          reference: 'juan',
          currency: Currency.PEN,
          displayName: 'Juan',
          pendingDebt: 500,
          pendingLoan: 0,
          netOwed: -500,
          pendingCount: 1,
          settledCount: 0,
        },
      ]);

      return request(app.getHttpServer())
        .get('/api/v1/debts/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(1);
          expect(body.data[0].netOwed).toBe(-500);
        });
    });
  });

  describe('POST /api/v1/debts', () => {
    it('creates a PENDING DEBT and returns its response shape', () => {
      return request(app.getHttpServer())
        .post('/api/v1/debts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'DEBT', currency: 'PEN', amount: 250, reference: 'Pedro' })
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.type).toBe('DEBT');
          expect(body.data.currency).toBe('PEN');
          expect(body.data.amount).toBe(250);
          expect(body.data.remainingAmount).toBe(250);
          expect(body.data.status).toBe('PENDING');
          expect(body.data.reference).toBe('Pedro');
        });
    });

    it('rejects empty reference with 400 (class-validator before reaching use case)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/debts')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'DEBT', currency: 'PEN', amount: 100, reference: '' })
        .expect(400);
    });
  });

  describe('GET /api/v1/debts/:id', () => {
    it('returns DBT_001 when not found', () => {
      mockRepo.findById.mockResolvedValue(null);
      return request(app.getHttpServer())
        .get(`/api/v1/debts/${DEBT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('DBT_001');
        });
    });

    it('returns DBT_002 when owned by another user', () => {
      mockRepo.findById.mockResolvedValue(
        buildDebtLoan({ id: DEBT_ID, userId: 'some-other-user' }),
      );
      return request(app.getHttpServer())
        .get(`/api/v1/debts/${DEBT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403)
        .expect(({ body }) => {
          expect(body.error.code).toBe('DBT_002');
        });
    });
  });

  describe('PATCH /api/v1/debts/:id', () => {
    it('returns DBT_005 when patching non-amount on SETTLED row', () => {
      mockRepo.findById.mockResolvedValue(
        buildDebtLoan({
          id: DEBT_ID,
          userId: USER_ID,
          status: DebtLoanStatus.SETTLED,
          remainingAmount: 0,
        }),
      );
      return request(app.getHttpServer())
        .patch(`/api/v1/debts/${DEBT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'nope' })
        .expect(409)
        .expect(({ body }) => {
          expect(body.error.code).toBe('DBT_005');
        });
    });

    it('updates description on a PENDING row', () => {
      mockRepo.findById.mockResolvedValue(
        buildDebtLoan({ id: DEBT_ID, userId: USER_ID, description: 'old' }),
      );
      return request(app.getHttpServer())
        .patch(`/api/v1/debts/${DEBT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'updated description' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.description).toBe('updated description');
        });
    });
  });

  describe('DELETE /api/v1/debts/:id', () => {
    it('returns 204 on success', () => {
      mockRepo.findById.mockResolvedValue(buildDebtLoan({ id: DEBT_ID, userId: USER_ID }));
      return request(app.getHttpServer())
        .delete(`/api/v1/debts/${DEBT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });

  describe('POST /api/v1/debts/:id/settle', () => {
    it('informal-close: settles without touching pool', async () => {
      mockRepo.findById.mockResolvedValue(
        buildDebtLoan({
          id: DEBT_ID,
          userId: USER_ID,
          type: DebtLoanType.DEBT,
          currency: Currency.PEN,
          amount: 100,
          remainingAmount: 100,
        }),
      );

      await request(app.getHttpServer())
        .post(`/api/v1/debts/${DEBT_ID}/settle`)
        .set('Authorization', `Bearer ${token}`)
        .send({ settledAmount: 100 })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.status).toBe('SETTLED');
          expect(body.data.remainingAmount).toBe(0);
        });

      expect(mockPool.applyDelta).not.toHaveBeenCalled();
    });

    it('real-payment DEBT: debits pool by settledAmount inside a tx', async () => {
      mockRepo.findById.mockResolvedValue(
        buildDebtLoan({
          id: DEBT_ID,
          userId: USER_ID,
          type: DebtLoanType.DEBT,
          currency: Currency.PEN,
          remainingAmount: 100,
        }),
      );

      await request(app.getHttpServer())
        .post(`/api/v1/debts/${DEBT_ID}/settle`)
        .set('Authorization', `Bearer ${token}`)
        .send({ settledAmount: 40, currency: 'PEN' })
        .expect(200);

      expect(mockPool.applyDelta).toHaveBeenCalledWith(USER_ID, 'PEN', -40, fakeManager);
    });

    it('returns DBT_006 when settledAmount > remainingAmount', () => {
      mockRepo.findById.mockResolvedValue(
        buildDebtLoan({ id: DEBT_ID, userId: USER_ID, remainingAmount: 30 }),
      );
      return request(app.getHttpServer())
        .post(`/api/v1/debts/${DEBT_ID}/settle`)
        .set('Authorization', `Bearer ${token}`)
        .send({ settledAmount: 50 })
        .expect(422)
        .expect(({ body }) => {
          expect(body.error.code).toBe('DBT_006');
        });
    });
  });

  describe('POST /api/v1/debts/settle-by-reference', () => {
    it('informal-close bulk: settles all matching rows in any currency', async () => {
      const a = buildDebtLoan({ userId: USER_ID, currency: Currency.PEN, remainingAmount: 100 });
      const b = buildDebtLoan({ userId: USER_ID, currency: Currency.USD, remainingAmount: 50 });
      mockRepo.findPendingByNormalizedReference.mockResolvedValue([a, b]);

      await request(app.getHttpServer())
        .post('/api/v1/debts/settle-by-reference')
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'Juan' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.settledCount).toBe(2);
          expect(body.data.totalSettledAmount).toBe(150);
          expect(body.data.currency).toBeNull();
        });

      expect(mockPool.applyDelta).not.toHaveBeenCalled();
    });

    it('real-payment bulk: filters by currency and applies net delta', async () => {
      const debt = buildDebtLoan({
        userId: USER_ID,
        type: DebtLoanType.DEBT,
        currency: Currency.PEN,
        remainingAmount: 60,
      });
      const loan = buildDebtLoan({
        userId: USER_ID,
        type: DebtLoanType.LOAN,
        currency: Currency.PEN,
        remainingAmount: 20,
      });
      mockRepo.findPendingByNormalizedReference.mockResolvedValue([debt, loan]);

      await request(app.getHttpServer())
        .post('/api/v1/debts/settle-by-reference')
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'Juan', currency: 'PEN' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.settledCount).toBe(2);
          expect(body.data.currency).toBe('PEN');
        });

      // Net: -60 (debt) + 20 (loan) = -40.
      expect(mockPool.applyDelta).toHaveBeenCalledWith(USER_ID, 'PEN', -40, fakeManager);
    });
  });
});
