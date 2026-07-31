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

import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';
import { JwtAccessStrategy } from '../src/modules/auth/infrastructure/strategies/jwt-access.strategy';
import { ArchiveMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/archive-monthly-service.use-case';
import { CreateMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/create-monthly-service.use-case';
import { DeleteMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/delete-monthly-service.use-case';
import { GetMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/get-monthly-service.use-case';
import { ListMonthlyServiceParticipantsUseCase } from '../src/modules/monthly-services/application/use-cases/list-monthly-service-participants.use-case';
import { ListMonthlyServicesUseCase } from '../src/modules/monthly-services/application/use-cases/list-monthly-services.use-case';
import { ReplaceMonthlyServiceParticipantsUseCase } from '../src/modules/monthly-services/application/use-cases/replace-monthly-service-participants.use-case';
import { SkipMonthlyServiceMonthUseCase } from '../src/modules/monthly-services/application/use-cases/skip-monthly-service-month.use-case';
import { UpdateMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/update-monthly-service.use-case';
import { buildMonthlyService } from '../src/modules/monthly-services/domain/__tests__/monthly-service.factory';
import { MonthlyServiceParticipant } from '../src/modules/monthly-services/domain/entities/monthly-service-participant.entity';
import { MonthlyServiceRepository } from '../src/modules/monthly-services/domain/monthly-service.repository';
import { MonthlyServiceParticipantRepository } from '../src/modules/monthly-services/domain/repositories/monthly-service-participant.repository';
import { MonthlyServicesController } from '../src/modules/monthly-services/presentation/monthly-services.controller';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-msp-participants-batch-jwt-secret-32c!';
const USER_ID = 'e2e-user-uuid-msppb-0001';
const SVC_ID = '00000000-0000-4000-c000-000000000041';
const FAKE_MGR = { tx: true } as unknown as EntityManager;

function buildParticipant(
  overrides: Partial<{
    id: string;
    reference: string;
    normalizedReference: string;
    defaultAmount: number;
  }> = {},
): MonthlyServiceParticipant {
  const now = new Date('2026-07-27T12:00:00.000Z');
  return new MonthlyServiceParticipant({
    id: overrides.id ?? 'participant-1',
    monthlyServiceId: SVC_ID,
    userId: USER_ID,
    reference: overrides.reference ?? 'Ana',
    normalizedReference: overrides.normalizedReference ?? 'ana',
    defaultAmount: overrides.defaultAmount ?? 100,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

describe('MonthlyServiceParticipants batch replace (e2e)', () => {
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

  const mockParticipantRepo: jest.Mocked<MonthlyServiceParticipantRepository> = {
    findByServiceId: jest.fn(),
    findByNormalizedReference: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockDataSource: jest.Mocked<Pick<DataSource, 'transaction'>> = {
    transaction: jest
      .fn()
      .mockImplementation(<T>(cb: (m: EntityManager) => Promise<T>) => cb(FAKE_MGR)),
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
        ListMonthlyServiceParticipantsUseCase,
        ReplaceMonthlyServiceParticipantsUseCase,
        // The controller also depends on the parent-service use cases
        // (list/get/create/update/skip/archive/delete). They aren't
        // exercised here, but Nest still needs a provider to satisfy the
        // constructor — stub values are enough since no route under test
        // calls them.
        { provide: ListMonthlyServicesUseCase, useValue: {} },
        { provide: GetMonthlyServiceUseCase, useValue: {} },
        { provide: CreateMonthlyServiceUseCase, useValue: {} },
        { provide: UpdateMonthlyServiceUseCase, useValue: {} },
        { provide: SkipMonthlyServiceMonthUseCase, useValue: {} },
        { provide: ArchiveMonthlyServiceUseCase, useValue: {} },
        { provide: DeleteMonthlyServiceUseCase, useValue: {} },
        { provide: MonthlyServiceRepository, useValue: mockServiceRepo },
        { provide: MonthlyServiceParticipantRepository, useValue: mockParticipantRepo },
        { provide: DataSource, useValue: mockDataSource },
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

        // PinoLogger token required by AllExceptionsFilter's @InjectPinoLogger.
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
      { sub: USER_ID, email: 'user@test.com' },
      { secret: TEST_JWT_SECRET, expiresIn: '15m' },
    );
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ─── PUT /monthly-services/:id/participants ───────────────────────────────

  describe('PUT /api/v1/monthly-services/:id/participants', () => {
    it('should replace the full list (update+insert+soft-delete) and return 200', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, estimatedAmount: 500 });
      mockServiceRepo.findById.mockResolvedValue(service);
      const ana = buildParticipant({ id: 'p-ana', reference: 'Ana', defaultAmount: 100 });
      const luis = buildParticipant({
        id: 'p-luis',
        reference: 'Luis',
        normalizedReference: 'luis',
        defaultAmount: 80,
      });
      mockParticipantRepo.findByServiceId.mockResolvedValue([ana, luis]);
      mockParticipantRepo.save.mockImplementation((p) => Promise.resolve(p));
      mockParticipantRepo.softDelete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          participants: [
            { reference: 'Ana', defaultAmount: 150 },
            { reference: 'Marta', defaultAmount: 60 },
          ],
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toHaveLength(2);
          const references = (body.data as Array<{ reference: string }>)
            .map((p) => p.reference)
            .sort();
          expect(references).toEqual(['Ana', 'Marta']);
        });

      expect(mockParticipantRepo.softDelete).toHaveBeenCalledWith('p-luis', FAKE_MGR);
    });

    it('should replace with an empty array and remove all participants (200, empty result)', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, estimatedAmount: 300 });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockParticipantRepo.findByServiceId.mockResolvedValue([buildParticipant({ id: 'p-ana' })]);
      mockParticipantRepo.softDelete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ participants: [] })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toEqual([]);
        });
    });

    it('should return 409 MSP_PARTICIPANT_DUPLICATE_REFERENCE for a duplicate within the batch', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, estimatedAmount: 300 });
      mockServiceRepo.findById.mockResolvedValue(service);

      await request(app.getHttpServer())
        .put(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          participants: [
            { reference: 'Ana', defaultAmount: 100 },
            { reference: 'ana', defaultAmount: 50 },
          ],
        })
        .expect(409)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSP_007');
        });
    });

    it('should return 422 MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED when the batch sum exceeds estimatedAmount', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, estimatedAmount: 300 });
      mockServiceRepo.findById.mockResolvedValue(service);

      await request(app.getHttpServer())
        .put(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          participants: [
            { reference: 'Ana', defaultAmount: 200 },
            { reference: 'Luis', defaultAmount: 150 },
          ],
        })
        .expect(422)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSP_008');
        });
    });

    it('should return 400 when a batch amount is non-positive (class-validator @IsPositive)', async () => {
      // `@IsPositive()` on the DTO item rejects <= 0 before the request body
      // ever reaches the use case, so this is a 400 (validation), not the
      // use case's own 422 MSP_PARTICIPANT_AMOUNT_NOT_POSITIVE guard — that
      // guard is defense-in-depth for direct/internal callers, see the
      // dedicated unit test in replace-monthly-service-participants.use-case.spec.ts.
      await request(app.getHttpServer())
        .put(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ participants: [{ reference: 'Ana', defaultAmount: 0 }] })
        .expect(400);
    });

    it('should return 404 MSVC_002 when the service does not exist', async () => {
      mockServiceRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .put(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ participants: [{ reference: 'Ana', defaultAmount: 100 }] })
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSVC_002');
        });
    });

    it('should return 400 when participants is missing (class-validator)', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('should return 400 when the batch exceeds the array size cap (@ArrayMaxSize)', async () => {
      // Anti-DoS bound: a 51-element batch is rejected at the validation
      // layer (`@ArrayMaxSize(50)`) before the use case ever runs.
      const participants = Array.from({ length: 51 }, (_, i) => ({
        reference: `P${i}`,
        defaultAmount: 1,
      }));

      await request(app.getHttpServer())
        .put(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ participants })
        .expect(400);
    });

    it('should return 400 for a malformed nested participant item (nested class-validator)', async () => {
      // A row with the wrong types (`reference` a number, `defaultAmount` a
      // string) fails `@ValidateNested`/`@Type` per-item validation.
      await request(app.getHttpServer())
        .put(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ participants: [{ reference: 123, defaultAmount: 'x' }] })
        .expect(400);
    });
  });

  // ─── GET /monthly-services/:id/participants (unchanged, still present) ───

  describe('GET /api/v1/monthly-services/:id/participants', () => {
    it('should list active participants and return 200', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockParticipantRepo.findByServiceId.mockResolvedValue([buildParticipant()]);

      await request(app.getHttpServer())
        .get(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(1);
          expect(body.data[0].reference).toBe('Ana');
        });
    });
  });
});
