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
import { BulkSettleByReferenceUseCase } from '../src/modules/transactions/application/use-cases/bulk-settle-by-reference.use-case';
import { CreateTransactionUseCase } from '../src/modules/transactions/application/use-cases/create-transaction.use-case';
import { DeleteTransactionUseCase } from '../src/modules/transactions/application/use-cases/delete-transaction.use-case';
import { GetDebtsSummaryUseCase } from '../src/modules/transactions/application/use-cases/get-debts-summary.use-case';
import { GetTransactionByIdUseCase } from '../src/modules/transactions/application/use-cases/get-transaction-by-id.use-case';
import { GetTransactionsUseCase } from '../src/modules/transactions/application/use-cases/get-transactions.use-case';
import { SettleTransactionUseCase } from '../src/modules/transactions/application/use-cases/settle-transaction.use-case';
import { UpdateTransactionUseCase } from '../src/modules/transactions/application/use-cases/update-transaction.use-case';
import { buildTransaction } from '../src/modules/transactions/domain/__tests__/transaction.factory';
import { TransactionStatus } from '../src/modules/transactions/domain/enums/transaction-status.enum';
import { TransactionType } from '../src/modules/transactions/domain/enums/transaction-type.enum';
import { TransactionRepository } from '../src/modules/transactions/domain/transaction.repository';
import { TransactionsController } from '../src/modules/transactions/presentation/transactions.controller';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-test-jwt-secret-min-32-characters!!';
const USER_ID = 'e2e-user-uuid-0001';
const ACC_ID_1 = '00000000-0000-4000-a000-000000000001';
const ACC_ID_2 = '00000000-0000-4000-a000-000000000002';
const CAT_ID = '00000000-0000-4000-b000-000000000001';

describe('TransactionsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

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
  };

  const mockAccountRepo: jest.Mocked<AccountRepository> = {
    findByUserId: jest.fn(),
    findByUserIdAndName: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(),
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
      controllers: [TransactionsController],
      providers: [
        CreateTransactionUseCase,
        GetTransactionsUseCase,
        GetTransactionByIdUseCase,
        UpdateTransactionUseCase,
        DeleteTransactionUseCase,
        SettleTransactionUseCase,
        GetDebtsSummaryUseCase,
        BulkSettleByReferenceUseCase,
        { provide: TransactionRepository, useValue: mockTxRepo },
        { provide: AccountRepository, useValue: mockAccountRepo },
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

        // PinoLogger tokens needed by migrated providers
        ...buildPinoLoggerProviders([
          AllExceptionsFilter.name,
          CreateTransactionUseCase.name,
          SettleTransactionUseCase.name,
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

  beforeEach(() => jest.clearAllMocks());

  // ─── Auth ─────────────────────────────────────────────────────────────────────

  describe('authentication', () => {
    it('should return 401 without a token', () => {
      return request(app.getHttpServer()).get('/api/v1/transactions').expect(401);
    });
  });

  // ─── POST /transactions ───────────────────────────────────────────────────────

  describe('POST /api/v1/transactions', () => {
    const validBody = {
      accountId: ACC_ID_1,
      categoryId: CAT_ID,
      type: TransactionType.EXPENSE,
      amount: 50,
      description: 'Almuerzo',
      date: '2026-01-15T12:00:00Z',
    };

    it('should create a transaction and return 201', async () => {
      const account = buildAccount({ id: ACC_ID_1, userId: USER_ID, balance: 200 });
      mockAccountRepo.findById.mockResolvedValue(account);
      mockAccountRepo.save.mockResolvedValue(account);

      const tx = buildTransaction({ userId: USER_ID, accountId: ACC_ID_1, amount: 50 });
      mockTxRepo.save.mockResolvedValue(tx);

      return request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody)
        .expect(201)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).not.toHaveProperty('deletedAt');
        });
    });

    it('should return 400 when required fields are missing', () => {
      return request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 50 })
        .expect(400);
    });

    it('should return 404 when account does not exist', async () => {
      mockAccountRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody)
        .expect(404);
    });

    it('should return 422 for transfer to same account', async () => {
      const account = buildAccount({ id: ACC_ID_1, userId: USER_ID });
      mockAccountRepo.findById.mockResolvedValue(account);

      return request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validBody,
          type: TransactionType.TRANSFER,
          destinationAccountId: ACC_ID_1,
        })
        .expect(422);
    });

    it('should return 422 for transfer with mismatched currencies', async () => {
      const source = buildAccount({ id: ACC_ID_1, userId: USER_ID, currency: Currency.PEN });
      const dest = buildAccount({ id: ACC_ID_2, userId: USER_ID, currency: Currency.USD });
      mockAccountRepo.findById.mockImplementation((id) => {
        if (id === ACC_ID_1) return Promise.resolve(source);
        if (id === ACC_ID_2) return Promise.resolve(dest);
        return Promise.resolve(null);
      });

      return request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validBody,
          type: TransactionType.TRANSFER,
          destinationAccountId: ACC_ID_2,
        })
        .expect(422);
    });

    it('should create a DEBT with status PENDING and return 201', async () => {
      const account = buildAccount({ id: ACC_ID_1, userId: USER_ID, balance: 500 });
      mockAccountRepo.findById.mockResolvedValue(account);

      const debtTx = buildTransaction({
        userId: USER_ID,
        accountId: ACC_ID_1,
        type: TransactionType.DEBT,
        amount: 100,
        reference: 'Juan',
        status: TransactionStatus.PENDING,
        remainingAmount: 100,
      });
      mockTxRepo.save.mockResolvedValue(debtTx);

      return request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: ACC_ID_1,
          type: TransactionType.DEBT,
          amount: 100,
          reference: 'Juan',
          date: '2026-01-15T12:00:00Z',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.type).toBe(TransactionType.DEBT);
          expect(body.data.status).toBe(TransactionStatus.PENDING);
          expect(body.data.remainingAmount).toBe(100);
          expect(body.data.reference).toBe('Juan');
        });
    });

    it('should return 422 for DEBT without reference', async () => {
      const account = buildAccount({ id: ACC_ID_1, userId: USER_ID });
      mockAccountRepo.findById.mockResolvedValue(account);

      return request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountId: ACC_ID_1,
          type: TransactionType.DEBT,
          amount: 100,
          date: '2026-01-15T12:00:00Z',
        })
        .expect(422);
    });
  });

  // ─── POST /transactions/:id/settle ──────────────────────────────────────────

  describe('POST /api/v1/transactions/:id/settle', () => {
    it('should settle a DEBT partially and return 201', async () => {
      const debt = buildTransaction({
        id: '00000000-0000-4000-c000-000000000001',
        userId: USER_ID,
        type: TransactionType.DEBT,
        amount: 100,
        remainingAmount: 100,
        status: TransactionStatus.PENDING,
        reference: 'Juan',
        description: 'Deuda test',
        categoryId: CAT_ID,
      });
      const account = buildAccount({ id: ACC_ID_1, userId: USER_ID, balance: 500 });

      mockTxRepo.findById.mockResolvedValue(debt);
      mockAccountRepo.findById.mockResolvedValue(account);
      mockAccountRepo.save.mockResolvedValue(account);
      mockTxRepo.save.mockImplementation((tx) => Promise.resolve(tx));

      return request(app.getHttpServer())
        .post(`/api/v1/transactions/${debt.id}/settle`)
        .set('Authorization', `Bearer ${token}`)
        .send({ accountId: ACC_ID_1, amount: 60 })
        .expect(201)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.type).toBe(TransactionType.EXPENSE);
          expect(body.data.amount).toBe(60);
          expect(body.data.relatedTransactionId).toBe(debt.id);
        });
    });

    it('should return 422 for non-DEBT/LOAN transaction', async () => {
      const expense = buildTransaction({
        id: '00000000-0000-4000-c000-000000000002',
        userId: USER_ID,
        type: TransactionType.EXPENSE,
      });
      mockTxRepo.findById.mockResolvedValue(expense);

      return request(app.getHttpServer())
        .post(`/api/v1/transactions/${expense.id}/settle`)
        .set('Authorization', `Bearer ${token}`)
        .send({ accountId: ACC_ID_1, amount: 50 })
        .expect(422);
    });

    it('should return 409 for already settled transaction', async () => {
      const debt = buildTransaction({
        id: '00000000-0000-4000-c000-000000000003',
        userId: USER_ID,
        type: TransactionType.DEBT,
        status: TransactionStatus.SETTLED,
        remainingAmount: 0,
      });
      mockTxRepo.findById.mockResolvedValue(debt);

      return request(app.getHttpServer())
        .post(`/api/v1/transactions/${debt.id}/settle`)
        .set('Authorization', `Bearer ${token}`)
        .send({ accountId: ACC_ID_1, amount: 50 })
        .expect(409);
    });

    it('should return 422 when amount exceeds remaining', async () => {
      const debt = buildTransaction({
        id: '00000000-0000-4000-c000-000000000004',
        userId: USER_ID,
        type: TransactionType.DEBT,
        amount: 100,
        remainingAmount: 30,
        status: TransactionStatus.PENDING,
      });
      mockTxRepo.findById.mockResolvedValue(debt);

      return request(app.getHttpServer())
        .post(`/api/v1/transactions/${debt.id}/settle`)
        .set('Authorization', `Bearer ${token}`)
        .send({ accountId: ACC_ID_1, amount: 50 })
        .expect(422);
    });
  });

  // ─── GET /transactions ────────────────────────────────────────────────────────

  describe('GET /api/v1/transactions', () => {
    it('should return 200 with the list of transactions', async () => {
      const txs = [buildTransaction({ userId: USER_ID }), buildTransaction({ userId: USER_ID })];
      mockTxRepo.findByUserId.mockResolvedValue({ items: txs, total: 2 });

      return request(app.getHttpServer())
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toHaveLength(2);
          expect(body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
        });
    });

    it('should return 200 with empty list', async () => {
      mockTxRepo.findByUserId.mockResolvedValue({ items: [], total: 0 });

      return request(app.getHttpServer())
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toEqual([]);
        });
    });
  });

  // ─── GET /transactions/:id ────────────────────────────────────────────────────

  describe('GET /api/v1/transactions/:id', () => {
    it('should return 200 with the transaction', async () => {
      const tx = buildTransaction({ userId: USER_ID });
      mockTxRepo.findById.mockResolvedValue(tx);

      return request(app.getHttpServer())
        .get(`/api/v1/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.id).toBe(tx.id);
        });
    });

    it('should return 404 when not found', async () => {
      mockTxRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/api/v1/transactions/nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 403 when belongs to another user', async () => {
      const tx = buildTransaction({ userId: 'other-user' });
      mockTxRepo.findById.mockResolvedValue(tx);

      return request(app.getHttpServer())
        .get(`/api/v1/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  // ─── PATCH /transactions/:id ──────────────────────────────────────────────────

  describe('PATCH /api/v1/transactions/:id', () => {
    it('should update a transaction and return 200', async () => {
      const tx = buildTransaction({ userId: USER_ID, description: 'Old' });
      mockTxRepo.findById.mockResolvedValue(tx);
      mockTxRepo.save.mockResolvedValue({ ...tx, description: 'New' } as typeof tx);

      return request(app.getHttpServer())
        .patch(`/api/v1/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'New' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
        });
    });

    it('should return 404 when not found', async () => {
      mockTxRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .patch('/api/v1/transactions/nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'New' })
        .expect(404);
    });

    it('should return 409 when updating a settled DEBT', async () => {
      const tx = buildTransaction({
        userId: USER_ID,
        type: TransactionType.DEBT,
        status: TransactionStatus.SETTLED,
        remainingAmount: 0,
      });
      mockTxRepo.findById.mockResolvedValue(tx);

      return request(app.getHttpServer())
        .patch(`/api/v1/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'New' })
        .expect(409);
    });
  });

  // ─── DELETE /transactions/:id ─────────────────────────────────────────────────

  describe('DELETE /api/v1/transactions/:id', () => {
    it('should soft delete and return 204', async () => {
      const tx = buildTransaction({
        userId: USER_ID,
        accountId: ACC_ID_1,
        type: TransactionType.EXPENSE,
        amount: 50,
      });
      const account = buildAccount({ id: ACC_ID_1, userId: USER_ID, balance: 150 });

      mockTxRepo.findById.mockResolvedValue(tx);
      mockAccountRepo.findByIds.mockResolvedValue([account]);
      mockAccountRepo.save.mockResolvedValue(account);
      mockTxRepo.softDelete.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/api/v1/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('should soft delete DEBT with cascade and return 204', async () => {
      const debt = buildTransaction({
        userId: USER_ID,
        accountId: ACC_ID_1,
        type: TransactionType.DEBT,
        amount: 100,
        remainingAmount: 40,
        status: TransactionStatus.PENDING,
      });
      const settlement = buildTransaction({
        userId: USER_ID,
        accountId: ACC_ID_1,
        type: TransactionType.EXPENSE,
        amount: 60,
        relatedTransactionId: debt.id,
      });
      const account = buildAccount({ id: ACC_ID_1, userId: USER_ID, balance: 200 });

      mockTxRepo.findById.mockResolvedValue(debt);
      mockTxRepo.findByRelatedTransactionId.mockResolvedValue([settlement]);
      mockAccountRepo.findByIds.mockResolvedValue([account]);
      mockAccountRepo.save.mockResolvedValue(account);
      mockTxRepo.softDelete.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/api/v1/transactions/${debt.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('should return 404 when not found', async () => {
      mockTxRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .delete('/api/v1/transactions/nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 403 when belongs to another user', async () => {
      const tx = buildTransaction({ userId: 'other-user' });
      mockTxRepo.findById.mockResolvedValue(tx);

      return request(app.getHttpServer())
        .delete(`/api/v1/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  // ─── GET /transactions/debts-summary ─────────────────────────────────────────

  describe('GET /api/v1/transactions/debts-summary', () => {
    it('should return 200 with an empty array when the user has no DEBT/LOAN', async () => {
      mockTxRepo.aggregateDebtsByReference.mockResolvedValue([]);

      return request(app.getHttpServer())
        .get('/api/v1/transactions/debts-summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toEqual([]);
        });
    });

    it('should return 200 with aggregated rows from the repository', async () => {
      mockTxRepo.aggregateDebtsByReference.mockResolvedValue([
        {
          reference: 'juan',
          currency: 'PEN',
          displayName: 'Juan',
          pendingDebt: 500,
          pendingLoan: 300,
          netOwed: -200,
          pendingCount: 3,
          settledCount: 1,
        },
      ]);

      return request(app.getHttpServer())
        .get('/api/v1/transactions/debts-summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(1);
          expect(body.data[0].displayName).toBe('Juan');
          expect(body.data[0].netOwed).toBe(-200);
        });
    });

    it('should forward the status query param to the repository', async () => {
      mockTxRepo.aggregateDebtsByReference.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/transactions/debts-summary?status=all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockTxRepo.aggregateDebtsByReference).toHaveBeenCalledWith(USER_ID, 'all');
    });

    it('should return 400 when status is not a valid enum value', () => {
      return request(app.getHttpServer())
        .get('/api/v1/transactions/debts-summary?status=nonsense')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return 401 without a token', () => {
      return request(app.getHttpServer()).get('/api/v1/transactions/debts-summary').expect(401);
    });
  });

  // ─── GET /transactions?search=... ────────────────────────────────────────────

  describe('GET /api/v1/transactions (search)', () => {
    it('should forward the search query param to the repository filters', async () => {
      mockTxRepo.findByUserId.mockResolvedValue({ items: [], total: 0 });

      await request(app.getHttpServer())
        .get('/api/v1/transactions?search=Juán')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockTxRepo.findByUserId).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ search: 'Juán' }),
        expect.any(Object),
      );
    });
  });

  // ─── POST /transactions/settle-by-reference ──────────────────────────────────

  describe('POST /api/v1/transactions/settle-by-reference', () => {
    it('should return 200 count=0 when no pending tx match (idempotent)', async () => {
      mockTxRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([]);

      return request(app.getHttpServer())
        .post('/api/v1/transactions/settle-by-reference')
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'Ghost' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toEqual({ settledIds: [], totalSettled: 0, count: 0 });
        });
    });

    it('should mark all matching pending tx as SETTLED and return the summary', async () => {
      const tx1 = buildTransaction({
        id: 'tx-1',
        userId: USER_ID,
        type: TransactionType.DEBT,
        amount: 500,
        remainingAmount: 500,
        status: TransactionStatus.PENDING,
        reference: 'Juan',
      });
      const tx2 = buildTransaction({
        id: 'tx-2',
        userId: USER_ID,
        type: TransactionType.LOAN,
        amount: 300,
        remainingAmount: 200,
        status: TransactionStatus.PENDING,
        reference: 'Juan',
      });
      mockTxRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([tx1, tx2]);
      mockTxRepo.save.mockImplementation((tx) => Promise.resolve(tx));

      return request(app.getHttpServer())
        .post('/api/v1/transactions/settle-by-reference')
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'Juan' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.count).toBe(2);
          expect(body.data.totalSettled).toBe(700);
          expect(body.data.settledIds).toEqual(['tx-1', 'tx-2']);
        });
    });

    it('should return 400 when reference is missing', () => {
      return request(app.getHttpServer())
        .post('/api/v1/transactions/settle-by-reference')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('should return 400 when reference is empty string', () => {
      return request(app.getHttpServer())
        .post('/api/v1/transactions/settle-by-reference')
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: '' })
        .expect(400);
    });

    it('should return 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/transactions/settle-by-reference')
        .send({ reference: 'Juan' })
        .expect(401);
    });

    it('should forward the currency filter from the body to the repository', async () => {
      mockTxRepo.findPendingDebtOrLoanByNormalizedReference.mockResolvedValue([]);

      await request(app.getHttpServer())
        .post('/api/v1/transactions/settle-by-reference')
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'Juan', currency: 'USD' })
        .expect(200);

      expect(mockTxRepo.findPendingDebtOrLoanByNormalizedReference).toHaveBeenCalledWith(
        USER_ID,
        'Juan',
        'USD',
      );
    });

    it('should return 400 when currency is not a valid enum value', () => {
      return request(app.getHttpServer())
        .post('/api/v1/transactions/settle-by-reference')
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'Juan', currency: 'XYZ' })
        .expect(400);
    });
  });
});
