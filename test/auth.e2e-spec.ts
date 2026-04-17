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
import { GoogleLoginUseCase } from '../src/modules/auth/application/use-cases/google-login.use-case';
import { LogoutUseCase } from '../src/modules/auth/application/use-cases/logout.use-case';
import { RotateRefreshTokenUseCase } from '../src/modules/auth/application/use-cases/rotate-refresh-token.use-case';
import { TestLoginUseCase } from '../src/modules/auth/application/use-cases/test-login.use-case';
import { buildRefreshToken } from '../src/modules/auth/domain/__tests__/refresh-token.factory';
import { RefreshTokenRepository } from '../src/modules/auth/domain/refresh-token.repository';
import { JwtAccessStrategy } from '../src/modules/auth/infrastructure/strategies/jwt-access.strategy';
import { AuthController } from '../src/modules/auth/presentation/auth.controller';
import { FindOrCreateUserUseCase } from '../src/modules/users/application/use-cases/find-or-create-user.use-case';
import { GetUserProfileUseCase } from '../src/modules/users/application/use-cases/get-user-profile.use-case';
import { buildUser } from '../src/modules/users/domain/__tests__/user.factory';
import { UserRepository } from '../src/modules/users/domain/user.repository';

const TEST_JWT_SECRET = 'e2e-test-jwt-secret-min-32-characters!!';

describe('AuthController /auth/me (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockUserRepo: jest.Mocked<UserRepository> = {
    findById: jest.fn(),
    findByGoogleId: jest.fn(),
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
      controllers: [AuthController],
      providers: [
        // Real use case under test
        GetUserProfileUseCase,
        { provide: UserRepository, useValue: mockUserRepo },

        // Strategy configured with test secret
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },

        // Auth controller dependencies not exercised in these tests
        { provide: GoogleLoginUseCase, useValue: { execute: jest.fn() } },
        { provide: LogoutUseCase, useValue: { execute: jest.fn() } },
        { provide: RotateRefreshTokenUseCase, useValue: { execute: jest.fn() } },
        { provide: TestLoginUseCase, useValue: { execute: jest.fn() } },

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
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 when no Authorization header is provided', () => {
      return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('should return 401 when the token is malformed', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-valid-jwt')
        .expect(401);
    });

    it('should return 401 when the token is signed with a different secret', () => {
      const token = jwtService.sign(
        { sub: 'user-1', email: 'test@test.com' },
        { secret: 'wrong-secret-completely-different!!', expiresIn: '15m' },
      );

      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should return 200 with wrapped user profile for a valid token', async () => {
      const user = buildUser({ isActive: true });
      mockUserRepo.findById.mockResolvedValue(user);

      const token = jwtService.sign(
        { sub: user.id, email: user.email },
        { secret: TEST_JWT_SECRET, expiresIn: '15m' },
      );

      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.id).toBe(user.id);
          expect(body.data.email).toBe(user.email);
          expect(body.data.name).toBe(user.name);
          expect(body.data).not.toHaveProperty('googleId');
        });
    });

    it('should return 404 when the authenticated user no longer exists', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      const token = jwtService.sign(
        { sub: 'deleted-user-id', email: 'ghost@test.com' },
        { secret: TEST_JWT_SECRET, expiresIn: '15m' },
      );

      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────────

const TEST_AUTH_SECRET = 'e2e-test-auth-secret-min-32-chars!!!';

describe('AuthController /auth/test-login (e2e)', () => {
  let app: INestApplication;

  const mockUserRepo: jest.Mocked<UserRepository> = {
    findById: jest.fn(),
    findByGoogleId: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRefreshTokenRepo: jest.Mocked<RefreshTokenRepository> = {
    create: jest.fn().mockResolvedValue(buildRefreshToken()),
    findByHashedToken: jest.fn(),
    revoke: jest.fn(),
    revokeAllByUserId: jest.fn(),
  };

  const configState: {
    nodeEnv: string;
    testAuthEnabled: boolean;
    testAuthSecret: string | undefined;
  } = {
    nodeEnv: 'test',
    testAuthEnabled: true,
    testAuthSecret: TEST_AUTH_SECRET,
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'app.nodeEnv':
          return configState.nodeEnv;
        case 'testAuth.enabled':
          return configState.testAuthEnabled;
        case 'testAuth.secret':
          return configState.testAuthSecret;
        case 'jwt.accessSecret':
          return TEST_JWT_SECRET;
        case 'jwt.accessExpiresIn':
          return '15m';
        case 'jwt.refreshSecret':
          return 'e2e-refresh-secret-min-32-characters!!';
        case 'jwt.refreshExpiresIn':
          return '7d';
        default:
          return undefined;
      }
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'jwt.accessSecret') return TEST_JWT_SECRET;
      throw new Error(`Config key not found in test: ${key}`);
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({})],
      controllers: [AuthController],
      providers: [
        // Real use cases under test — TestLogin delegates to FindOrCreateUser + GoogleLogin
        TestLoginUseCase,
        FindOrCreateUserUseCase,
        GoogleLoginUseCase,
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: RefreshTokenRepository, useValue: mockRefreshTokenRepo },

        // Strategy + config
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },

        // Auth controller dependencies not exercised here
        { provide: LogoutUseCase, useValue: { execute: jest.fn() } },
        { provide: RotateRefreshTokenUseCase, useValue: { execute: jest.fn() } },
        { provide: GetUserProfileUseCase, useValue: { execute: jest.fn() } },

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
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    configState.nodeEnv = 'test';
    configState.testAuthEnabled = true;
    configState.testAuthSecret = TEST_AUTH_SECRET;
    mockUserRepo.findByGoogleId.mockResolvedValue(null);
    mockUserRepo.create.mockImplementation((profile) =>
      Promise.resolve(
        buildUser({
          googleId: profile.googleId,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        }),
      ),
    );
    mockRefreshTokenRepo.create.mockResolvedValue(buildRefreshToken());
  });

  describe('POST /api/v1/auth/test-login — triple-guard denials', () => {
    it('should return 404 when x-test-auth-secret header is missing', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/test-login')
        .send({ email: 'e2e@habit-sumaq.test' })
        .expect(404);
    });

    it('should return 404 when x-test-auth-secret header is wrong', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/test-login')
        .set('x-test-auth-secret', 'wrong-value-same-length-padding-ok!')
        .send({ email: 'e2e@habit-sumaq.test' })
        .expect(404);
    });

    it('should return 404 when testAuth.enabled is false', () => {
      configState.testAuthEnabled = false;

      return request(app.getHttpServer())
        .post('/api/v1/auth/test-login')
        .set('x-test-auth-secret', TEST_AUTH_SECRET)
        .send({ email: 'e2e@habit-sumaq.test' })
        .expect(404);
    });

    it('should return 404 when NODE_ENV is production (even with correct secret and flag)', () => {
      configState.nodeEnv = 'production';

      return request(app.getHttpServer())
        .post('/api/v1/auth/test-login')
        .set('x-test-auth-secret', TEST_AUTH_SECRET)
        .send({ email: 'e2e@habit-sumaq.test' })
        .expect(404);
    });
  });

  describe('POST /api/v1/auth/test-login — happy path', () => {
    it('should return 201 with accessToken and set a HttpOnly refresh cookie', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/test-login')
        .set('x-test-auth-secret', TEST_AUTH_SECRET)
        .send({ email: 'e2e@habit-sumaq.test' })
        .expect(201)
        .expect(({ body, headers }) => {
          expect(body.success).toBe(true);
          expect(typeof body.data.accessToken).toBe('string');
          expect(body.data.accessToken.length).toBeGreaterThan(0);

          const setCookie = headers['set-cookie'];
          const cookieLine = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie ?? '');
          expect(cookieLine).toMatch(/refresh_token=/);
          expect(cookieLine).toMatch(/HttpOnly/i);
        });

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ googleId: 'test-e2e@habit-sumaq.test' }),
      );
    });
  });

  describe('POST /api/v1/auth/test-login — body validation', () => {
    it('should return 400 when body is empty', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/test-login')
        .set('x-test-auth-secret', TEST_AUTH_SECRET)
        .send({})
        .expect(400);
    });

    it('should return 400 when email is not a valid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/test-login')
        .set('x-test-auth-secret', TEST_AUTH_SECRET)
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });
});
