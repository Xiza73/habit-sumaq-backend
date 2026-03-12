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
import { ArchiveAccountUseCase } from '../src/modules/accounts/application/use-cases/archive-account.use-case';
import { CreateAccountUseCase } from '../src/modules/accounts/application/use-cases/create-account.use-case';
import { DeleteAccountUseCase } from '../src/modules/accounts/application/use-cases/delete-account.use-case';
import { GetAccountByIdUseCase } from '../src/modules/accounts/application/use-cases/get-account-by-id.use-case';
import { GetAccountsUseCase } from '../src/modules/accounts/application/use-cases/get-accounts.use-case';
import { UpdateAccountUseCase } from '../src/modules/accounts/application/use-cases/update-account.use-case';
import { buildAccount } from '../src/modules/accounts/domain/__tests__/account.factory';
import { AccountType } from '../src/modules/accounts/domain/enums/account-type.enum';
import { Currency } from '../src/modules/accounts/domain/enums/currency.enum';
import { AccountRepository } from '../src/modules/accounts/domain/account.repository';
import { AccountsController } from '../src/modules/accounts/presentation/accounts.controller';
import { JwtAccessStrategy } from '../src/modules/auth/infrastructure/strategies/jwt-access.strategy';

const TEST_JWT_SECRET = 'e2e-test-jwt-secret-min-32-characters!!';
const USER_ID = 'e2e-user-uuid-0001';

describe('AccountsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockAccountRepo: jest.Mocked<AccountRepository> = {
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
      controllers: [AccountsController],
      providers: [
        // Real use cases under test
        CreateAccountUseCase,
        GetAccountsUseCase,
        GetAccountByIdUseCase,
        UpdateAccountUseCase,
        ArchiveAccountUseCase,
        DeleteAccountUseCase,
        { provide: AccountRepository, useValue: mockAccountRepo },

        // Strategy configured with test secret
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },

        // Same global infrastructure as production app
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
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

  // ─── Auth guard ─────────────────────────────────────────────────────────────

  describe('authentication', () => {
    it('should return 401 on any endpoint without a token', () => {
      return request(app.getHttpServer()).get('/api/v1/accounts').expect(401);
    });
  });

  // ─── POST /accounts ──────────────────────────────────────────────────────────

  describe('POST /api/v1/accounts', () => {
    const validBody = {
      name: 'Cuenta BCP',
      type: AccountType.CHECKING,
      currency: Currency.PEN,
    };

    it('should create an account and return 201', async () => {
      const account = buildAccount({ userId: USER_ID, name: 'Cuenta BCP' });
      mockAccountRepo.findByUserIdAndName.mockResolvedValue(null);
      mockAccountRepo.save.mockResolvedValue(account);

      return request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody)
        .expect(201)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.name).toBe(account.name);
          expect(body.data.userId).toBe(USER_ID);
          expect(body.data).not.toHaveProperty('deletedAt');
        });
    });

    it('should return 400 when required fields are missing', () => {
      return request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Solo nombre' })
        .expect(400);
    });

    it('should return 409 when account name is already taken', async () => {
      mockAccountRepo.findByUserIdAndName.mockResolvedValue(
        buildAccount({ userId: USER_ID, name: 'Cuenta BCP' }),
      );

      return request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody)
        .expect(409);
    });
  });

  // ─── GET /accounts ────────────────────────────────────────────────────────────

  describe('GET /api/v1/accounts', () => {
    it('should return 200 with an empty list', async () => {
      mockAccountRepo.findByUserId.mockResolvedValue([]);

      return request(app.getHttpServer())
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toEqual([]);
        });
    });

    it('should return 200 with the list of accounts', async () => {
      const accounts = [buildAccount({ userId: USER_ID }), buildAccount({ userId: USER_ID })];
      mockAccountRepo.findByUserId.mockResolvedValue(accounts);

      return request(app.getHttpServer())
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(2);
        });
    });

    it('should pass includeArchived query to repository', async () => {
      mockAccountRepo.findByUserId.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/accounts?includeArchived=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockAccountRepo.findByUserId).toHaveBeenCalledWith(USER_ID, true);
    });
  });

  // ─── GET /accounts/:id ────────────────────────────────────────────────────────

  describe('GET /api/v1/accounts/:id', () => {
    it('should return 200 with the account', async () => {
      const account = buildAccount({ userId: USER_ID });
      mockAccountRepo.findById.mockResolvedValue(account);

      return request(app.getHttpServer())
        .get(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.id).toBe(account.id);
        });
    });

    it('should return 404 when account does not exist', async () => {
      mockAccountRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/api/v1/accounts/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 403 when account belongs to another user', async () => {
      const account = buildAccount({ userId: 'another-user-id' });
      mockAccountRepo.findById.mockResolvedValue(account);

      return request(app.getHttpServer())
        .get(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  // ─── PATCH /accounts/:id ──────────────────────────────────────────────────────

  describe('PATCH /api/v1/accounts/:id', () => {
    it('should update the account and return 200', async () => {
      const account = buildAccount({ userId: USER_ID, name: 'Cuenta BCP' });
      mockAccountRepo.findById.mockResolvedValue(account);
      mockAccountRepo.findByUserIdAndName.mockResolvedValue(null);
      mockAccountRepo.save.mockResolvedValue({ ...account, name: 'Cuenta BBVA' } as typeof account);

      return request(app.getHttpServer())
        .patch(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Cuenta BBVA' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
        });
    });

    it('should return 404 when account does not exist', async () => {
      mockAccountRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .patch('/api/v1/accounts/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nuevo nombre' })
        .expect(404);
    });

    it('should return 409 when new name is already taken', async () => {
      const account = buildAccount({ userId: USER_ID, name: 'Cuenta BCP' });
      mockAccountRepo.findById.mockResolvedValue(account);
      mockAccountRepo.findByUserIdAndName.mockResolvedValue(
        buildAccount({ userId: USER_ID, name: 'Cuenta BBVA' }),
      );

      return request(app.getHttpServer())
        .patch(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Cuenta BBVA' })
        .expect(409);
    });
  });

  // ─── PATCH /accounts/:id/archive ──────────────────────────────────────────────

  describe('PATCH /api/v1/accounts/:id/archive', () => {
    it('should archive the account and return 200', async () => {
      const account = buildAccount({ userId: USER_ID, isArchived: false });
      mockAccountRepo.findById.mockResolvedValue(account);
      mockAccountRepo.save.mockResolvedValue({ ...account, isArchived: true } as typeof account);

      return request(app.getHttpServer())
        .patch(`/api/v1/accounts/${account.id}/archive`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
        });
    });

    it('should return 404 when account does not exist', async () => {
      mockAccountRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .patch('/api/v1/accounts/non-existent-id/archive')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ─── DELETE /accounts/:id ──────────────────────────────────────────────────────

  describe('DELETE /api/v1/accounts/:id', () => {
    it('should soft delete the account and return 204', async () => {
      const account = buildAccount({ userId: USER_ID });
      mockAccountRepo.findById.mockResolvedValue(account);
      mockAccountRepo.softDelete.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('should return 404 when account does not exist', async () => {
      mockAccountRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .delete('/api/v1/accounts/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 403 when account belongs to another user', async () => {
      const account = buildAccount({ userId: 'another-user' });
      mockAccountRepo.findById.mockResolvedValue(account);

      return request(app.getHttpServer())
        .delete(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
