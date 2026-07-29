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
import { AddMonthlyServiceParticipantUseCase } from '../src/modules/monthly-services/application/use-cases/add-monthly-service-participant.use-case';
import { ArchiveMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/archive-monthly-service.use-case';
import { CreateMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/create-monthly-service.use-case';
import { DeleteMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/delete-monthly-service.use-case';
import { GetMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/get-monthly-service.use-case';
import { ListMonthlyServiceParticipantsUseCase } from '../src/modules/monthly-services/application/use-cases/list-monthly-service-participants.use-case';
import { ListMonthlyServicesUseCase } from '../src/modules/monthly-services/application/use-cases/list-monthly-services.use-case';
import { RemoveMonthlyServiceParticipantUseCase } from '../src/modules/monthly-services/application/use-cases/remove-monthly-service-participant.use-case';
import { SkipMonthlyServiceMonthUseCase } from '../src/modules/monthly-services/application/use-cases/skip-monthly-service-month.use-case';
import { UpdateMonthlyServiceUseCase } from '../src/modules/monthly-services/application/use-cases/update-monthly-service.use-case';
import { UpdateMonthlyServiceParticipantUseCase } from '../src/modules/monthly-services/application/use-cases/update-monthly-service-participant.use-case';
import { buildMonthlyService } from '../src/modules/monthly-services/domain/__tests__/monthly-service.factory';
import { MonthlyServiceParticipant } from '../src/modules/monthly-services/domain/entities/monthly-service-participant.entity';
import { MonthlyServiceRepository } from '../src/modules/monthly-services/domain/monthly-service.repository';
import { MonthlyServiceParticipantRepository } from '../src/modules/monthly-services/domain/repositories/monthly-service-participant.repository';
import { MonthlyServicesController } from '../src/modules/monthly-services/presentation/monthly-services.controller';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-msp-participants-jwt-secret-min-32-chars!';
const USER_ID = 'e2e-user-uuid-mspp-0001';
const SVC_ID = '00000000-0000-4000-c000-000000000021';
const PARTICIPANT_ID = '00000000-0000-4000-d000-000000000031';

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
    id: overrides.id ?? PARTICIPANT_ID,
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

describe('MonthlyServiceParticipants (e2e)', () => {
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
        // Participant use cases — exercised by this e2e file.
        ListMonthlyServiceParticipantsUseCase,
        AddMonthlyServiceParticipantUseCase,
        UpdateMonthlyServiceParticipantUseCase,
        RemoveMonthlyServiceParticipantUseCase,
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

  // ─── POST /monthly-services/:id/participants ─────────────────────────────

  describe('POST /api/v1/monthly-services/:id/participants', () => {
    it('should add a participant and return 201', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, estimatedAmount: 300 });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockParticipantRepo.findByNormalizedReference.mockResolvedValue(null);
      mockParticipantRepo.findByServiceId.mockResolvedValue([]);
      mockParticipantRepo.save.mockImplementation((p) => Promise.resolve(p));

      await request(app.getHttpServer())
        .post(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'Ana', defaultAmount: 100 })
        .expect(201)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.reference).toBe('Ana');
          expect(body.data.defaultAmount).toBe(100);
        });
    });

    it('should return 409 MSP_PARTICIPANT_DUPLICATE_REFERENCE for a duplicate normalized reference', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, estimatedAmount: 300 });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockParticipantRepo.findByNormalizedReference.mockResolvedValue(buildParticipant());

      await request(app.getHttpServer())
        .post(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'ana', defaultAmount: 50 })
        .expect(409)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSP_007');
        });
    });

    it('should return 422 MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED when sum would exceed estimatedAmount', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, estimatedAmount: 300 });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockParticipantRepo.findByNormalizedReference.mockResolvedValue(null);
      mockParticipantRepo.findByServiceId.mockResolvedValue([
        buildParticipant({ reference: 'Ana', normalizedReference: 'ana', defaultAmount: 100 }),
      ]);

      await request(app.getHttpServer())
        .post(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'Luis', defaultAmount: 250 })
        .expect(422)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSP_008');
        });
    });

    it('should return 400 when defaultAmount is not positive (class-validator)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'Ana', defaultAmount: -10 })
        .expect(400);
    });

    it('should return 404 MSVC_002 when the service does not exist', async () => {
      mockServiceRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post(`/api/v1/monthly-services/${SVC_ID}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reference: 'Ana', defaultAmount: 100 })
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSVC_002');
        });
    });
  });

  // ─── PATCH /monthly-services/:id/participants/:participantId ─────────────

  describe('PATCH /api/v1/monthly-services/:id/participants/:participantId', () => {
    it('should edit the default amount and return 200', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID, estimatedAmount: 300 });
      const participant = buildParticipant({ defaultAmount: 100 });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockParticipantRepo.findByServiceId.mockResolvedValue([participant]);
      mockParticipantRepo.save.mockImplementation((p) => Promise.resolve(p));

      await request(app.getHttpServer())
        .patch(`/api/v1/monthly-services/${SVC_ID}/participants/${PARTICIPANT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ defaultAmount: 120 })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.defaultAmount).toBe(120);
        });
    });

    it('should return 404 for an unknown participant', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID });
      mockServiceRepo.findById.mockResolvedValue(service);
      mockParticipantRepo.findByServiceId.mockResolvedValue([]);

      await request(app.getHttpServer())
        .patch(`/api/v1/monthly-services/${SVC_ID}/participants/${PARTICIPANT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ defaultAmount: 50 })
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('MSP_006');
        });
    });
  });

  // ─── DELETE /monthly-services/:id/participants/:participantId ────────────

  describe('DELETE /api/v1/monthly-services/:id/participants/:participantId', () => {
    it('should remove the participant and return 204', async () => {
      const service = buildMonthlyService({ id: SVC_ID, userId: USER_ID });
      const participant = buildParticipant();
      mockServiceRepo.findById.mockResolvedValue(service);
      mockParticipantRepo.findByServiceId.mockResolvedValue([participant]);
      mockParticipantRepo.softDelete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/v1/monthly-services/${SVC_ID}/participants/${PARTICIPANT_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(mockParticipantRepo.softDelete).toHaveBeenCalledWith(PARTICIPANT_ID);
    });
  });
});
