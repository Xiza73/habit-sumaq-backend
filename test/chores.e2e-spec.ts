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
import { ArchiveChoreUseCase } from '../src/modules/chores/application/use-cases/archive-chore.use-case';
import { CreateChoreUseCase } from '../src/modules/chores/application/use-cases/create-chore.use-case';
import { DeleteChoreUseCase } from '../src/modules/chores/application/use-cases/delete-chore.use-case';
import { GetChoreUseCase } from '../src/modules/chores/application/use-cases/get-chore.use-case';
import { ListChoreLogsUseCase } from '../src/modules/chores/application/use-cases/list-chore-logs.use-case';
import { ListChoresUseCase } from '../src/modules/chores/application/use-cases/list-chores.use-case';
import { MarkChoreDoneUseCase } from '../src/modules/chores/application/use-cases/mark-chore-done.use-case';
import { SkipChoreCycleUseCase } from '../src/modules/chores/application/use-cases/skip-chore-cycle.use-case';
import { UpdateChoreUseCase } from '../src/modules/chores/application/use-cases/update-chore.use-case';
import { buildChore } from '../src/modules/chores/domain/__tests__/chore.factory';
import { buildChoreLog } from '../src/modules/chores/domain/__tests__/chore-log.factory';
import { ChoreRepository } from '../src/modules/chores/domain/chore.repository';
import { ChoreLogRepository } from '../src/modules/chores/domain/chore-log.repository';
import { IntervalUnit } from '../src/modules/chores/domain/enums/interval-unit.enum';
import { ChoresController } from '../src/modules/chores/presentation/chores.controller';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-chores-jwt-secret-min-32-characters!!';
const USER_ID = 'e2e-user-uuid-chores-001';
const CHORE_ID = '00000000-0000-4000-d000-000000000011';

describe('ChoresController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockChoreRepo: jest.Mocked<ChoreRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockLogRepo: jest.Mocked<ChoreLogRepository> = {
    findByChoreId: jest.fn(),
    countByChoreId: jest.fn(),
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
      controllers: [ChoresController],
      providers: [
        ListChoresUseCase,
        GetChoreUseCase,
        ListChoreLogsUseCase,
        CreateChoreUseCase,
        UpdateChoreUseCase,
        MarkChoreDoneUseCase,
        SkipChoreCycleUseCase,
        ArchiveChoreUseCase,
        DeleteChoreUseCase,
        { provide: ChoreRepository, useValue: mockChoreRepo },
        { provide: ChoreLogRepository, useValue: mockLogRepo },
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

        ...buildPinoLoggerProviders([
          AllExceptionsFilter.name,
          CreateChoreUseCase.name,
          MarkChoreDoneUseCase.name,
          SkipChoreCycleUseCase.name,
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
      return request(app.getHttpServer()).get('/api/v1/chores').expect(401);
    });
  });

  // ─── POST /chores ─────────────────────────────────────────────────────────────

  describe('POST /api/v1/chores', () => {
    const baseBody = {
      name: 'Lavar sábanas',
      intervalValue: 2,
      intervalUnit: IntervalUnit.WEEKS,
      startDate: '2026-04-15',
    };

    it('should create a chore and seed nextDueDate to startDate', async () => {
      mockChoreRepo.save.mockImplementation((c) => Promise.resolve(c));

      return request(app.getHttpServer())
        .post('/api/v1/chores')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send(baseBody)
        .expect(201)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.name).toBe('Lavar sábanas');
          expect(body.data.intervalValue).toBe(2);
          expect(body.data.intervalUnit).toBe('weeks');
          expect(body.data.startDate).toBe('2026-04-15');
          expect(body.data.nextDueDate).toBe('2026-04-15');
          expect(body.data.lastDoneDate).toBeNull();
          expect(body.data.isActive).toBe(true);
        });
    });

    it('should return 400 when intervalValue is zero', () => {
      return request(app.getHttpServer())
        .post('/api/v1/chores')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ ...baseBody, intervalValue: 0 })
        .expect(400);
    });

    it('should return 400 when startDate has wrong format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/chores')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ ...baseBody, startDate: '15-04-2026' })
        .expect(400);
    });

    it('should return 400 when intervalUnit is not allowed', () => {
      return request(app.getHttpServer())
        .post('/api/v1/chores')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ ...baseBody, intervalUnit: 'fortnights' })
        .expect(400);
    });
  });

  // ─── GET /chores ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/chores', () => {
    it('should return an empty list when the user has no chores', async () => {
      mockChoreRepo.findByUserId.mockResolvedValue([]);

      return request(app.getHttpServer())
        .get('/api/v1/chores')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toEqual([]);
        });
    });

    it('should hide archived chores by default and include them with ?includeArchived=true', async () => {
      const active = buildChore({ userId: USER_ID, name: 'Activa', isActive: true });
      const archived = buildChore({ userId: USER_ID, name: 'Archivada', isActive: false });

      mockChoreRepo.findByUserId.mockResolvedValueOnce([active]);
      await request(app.getHttpServer())
        .get('/api/v1/chores')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(1);
          expect(body.data[0].name).toBe('Activa');
        });
      expect(mockChoreRepo.findByUserId).toHaveBeenLastCalledWith(USER_ID, false);

      mockChoreRepo.findByUserId.mockResolvedValueOnce([active, archived]);
      await request(app.getHttpServer())
        .get('/api/v1/chores?includeArchived=true')
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(2);
        });
      expect(mockChoreRepo.findByUserId).toHaveBeenLastCalledWith(USER_ID, true);
    });

    it('should compute isOverdue using the client timezone', async () => {
      // Pin "now" so isOverdue is deterministic.
      jest.useFakeTimers().setSystemTime(new Date('2026-04-21T12:00:00Z'));

      const overdue = buildChore({ userId: USER_ID, name: 'Vencida', nextDueDate: '2026-04-10' });
      const upcoming = buildChore({ userId: USER_ID, name: 'Futura', nextDueDate: '2026-05-10' });
      mockChoreRepo.findByUserId.mockResolvedValue([overdue, upcoming]);

      try {
        await request(app.getHttpServer())
          .get('/api/v1/chores')
          .set('Authorization', `Bearer ${token}`)
          .set('x-timezone', 'America/Lima')
          .expect(200)
          .expect(({ body }) => {
            const items = body.data as Array<{ name: string; isOverdue: boolean }>;
            const v = items.find((i) => i.name === 'Vencida');
            const f = items.find((i) => i.name === 'Futura');
            expect(v?.isOverdue).toBe(true);
            expect(f?.isOverdue).toBe(false);
          });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // ─── GET /chores/:id ──────────────────────────────────────────────────────────

  describe('GET /api/v1/chores/:id', () => {
    it('should return the chore when it belongs to the user', async () => {
      const chore = buildChore({ id: CHORE_ID, userId: USER_ID });
      mockChoreRepo.findById.mockResolvedValue(chore);

      return request(app.getHttpServer())
        .get(`/api/v1/chores/${CHORE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.id).toBe(CHORE_ID);
        });
    });

    it('should return 404 CHRE_002 when the chore does not exist', async () => {
      mockChoreRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get(`/api/v1/chores/${CHORE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('CHRE_002');
        });
    });
  });

  // ─── GET /chores/:id/logs ─────────────────────────────────────────────────────

  describe('GET /api/v1/chores/:id/logs', () => {
    it('should return paginated logs with default limit/offset', async () => {
      const chore = buildChore({ id: CHORE_ID, userId: USER_ID });
      const logs = [buildChoreLog({ choreId: CHORE_ID }), buildChoreLog({ choreId: CHORE_ID })];
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockLogRepo.findByChoreId.mockResolvedValue({ data: logs, total: 2 });

      return request(app.getHttpServer())
        .get(`/api/v1/chores/${CHORE_ID}/logs`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toHaveLength(2);
          expect(body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
        });
      expect(mockLogRepo.findByChoreId).toHaveBeenCalledWith(CHORE_ID, 20, 0);
    });

    it('should cap limit at 100', async () => {
      const chore = buildChore({ id: CHORE_ID, userId: USER_ID });
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockLogRepo.findByChoreId.mockResolvedValue({ data: [], total: 0 });

      await request(app.getHttpServer())
        .get(`/api/v1/chores/${CHORE_ID}/logs?limit=500`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockLogRepo.findByChoreId).toHaveBeenCalledWith(CHORE_ID, 100, 0);
    });

    it('should return 404 CHRE_002 when the chore does not belong to the user', async () => {
      mockChoreRepo.findById.mockResolvedValue(buildChore({ userId: 'other-user' }));

      return request(app.getHttpServer())
        .get(`/api/v1/chores/${CHORE_ID}/logs`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('CHRE_002');
        });
    });
  });

  // ─── POST /chores/:id/done ────────────────────────────────────────────────────

  describe('POST /api/v1/chores/:id/done', () => {
    it('advances nextDueDate by interval when unit=days', async () => {
      const chore = buildChore({
        id: CHORE_ID,
        userId: USER_ID,
        intervalValue: 3,
        intervalUnit: IntervalUnit.DAYS,
        nextDueDate: '2026-04-15',
      });
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockChoreRepo.save.mockImplementation((c) => Promise.resolve(c));
      mockLogRepo.save.mockImplementation((l) => Promise.resolve(l));

      return request(app.getHttpServer())
        .post(`/api/v1/chores/${CHORE_ID}/done`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ doneAt: '2026-04-15' })
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.chore.lastDoneDate).toBe('2026-04-15');
          expect(body.data.chore.nextDueDate).toBe('2026-04-18');
          expect(body.data.log.doneAt).toBe('2026-04-15');
        });
    });

    it('advances by weeks correctly', async () => {
      const chore = buildChore({
        id: CHORE_ID,
        userId: USER_ID,
        intervalValue: 2,
        intervalUnit: IntervalUnit.WEEKS,
      });
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockChoreRepo.save.mockImplementation((c) => Promise.resolve(c));
      mockLogRepo.save.mockImplementation((l) => Promise.resolve(l));

      return request(app.getHttpServer())
        .post(`/api/v1/chores/${CHORE_ID}/done`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ doneAt: '2026-04-15' })
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.chore.nextDueDate).toBe('2026-04-29');
        });
    });

    it('advances by months and clamps day-of-month', async () => {
      const chore = buildChore({
        id: CHORE_ID,
        userId: USER_ID,
        intervalValue: 1,
        intervalUnit: IntervalUnit.MONTHS,
      });
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockChoreRepo.save.mockImplementation((c) => Promise.resolve(c));
      mockLogRepo.save.mockImplementation((l) => Promise.resolve(l));

      return request(app.getHttpServer())
        .post(`/api/v1/chores/${CHORE_ID}/done`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ doneAt: '2026-01-31' })
        .expect(201)
        .expect(({ body }) => {
          // Jan 31 + 1 month = Feb 28 (2026 non-leap)
          expect(body.data.chore.nextDueDate).toBe('2026-02-28');
        });
    });

    it('advances by years and clamps Feb 29 to Feb 28', async () => {
      const chore = buildChore({
        id: CHORE_ID,
        userId: USER_ID,
        intervalValue: 1,
        intervalUnit: IntervalUnit.YEARS,
      });
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockChoreRepo.save.mockImplementation((c) => Promise.resolve(c));
      mockLogRepo.save.mockImplementation((l) => Promise.resolve(l));

      return request(app.getHttpServer())
        .post(`/api/v1/chores/${CHORE_ID}/done`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ doneAt: '2024-02-29' })
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.chore.nextDueDate).toBe('2025-02-28');
        });
    });

    it('returns 404 CHRE_002 when the chore does not exist', async () => {
      mockChoreRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post(`/api/v1/chores/${CHORE_ID}/done`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({})
        .expect(404)
        .expect(({ body }) => {
          expect(body.error.code).toBe('CHRE_002');
        });
    });
  });

  // ─── POST /chores/:id/skip ────────────────────────────────────────────────────

  describe('POST /api/v1/chores/:id/skip', () => {
    it('advances nextDueDate += interval without creating a log', async () => {
      const chore = buildChore({
        id: CHORE_ID,
        userId: USER_ID,
        intervalValue: 2,
        intervalUnit: IntervalUnit.WEEKS,
        nextDueDate: '2026-04-15',
      });
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockChoreRepo.save.mockImplementation((c) => Promise.resolve(c));

      await request(app.getHttpServer())
        .post(`/api/v1/chores/${CHORE_ID}/skip`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({})
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.nextDueDate).toBe('2026-04-29');
        });

      expect(mockLogRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── PATCH /chores/:id ────────────────────────────────────────────────────────

  describe('PATCH /api/v1/chores/:id', () => {
    it('updates name, intervalValue and nextDueDate (manual override)', async () => {
      const chore = buildChore({
        id: CHORE_ID,
        userId: USER_ID,
        name: 'Old',
        nextDueDate: '2026-04-15',
      });
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockChoreRepo.save.mockImplementation((c) => Promise.resolve(c));

      return request(app.getHttpServer())
        .patch(`/api/v1/chores/${CHORE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ name: 'New name', intervalValue: 5, nextDueDate: '2026-06-01' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.name).toBe('New name');
          expect(body.data.intervalValue).toBe(5);
          expect(body.data.nextDueDate).toBe('2026-06-01');
        });
    });

    it('rejects startDate in the patch body (excluded by whitelist)', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/chores/${CHORE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .send({ startDate: '2026-09-01' })
        .expect(400);
    });
  });

  // ─── PATCH /chores/:id/archive ────────────────────────────────────────────────

  describe('PATCH /api/v1/chores/:id/archive', () => {
    it('toggles isActive across consecutive calls', async () => {
      const chore = buildChore({ id: CHORE_ID, userId: USER_ID, isActive: true });
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockChoreRepo.save.mockImplementation((c) => Promise.resolve(c));

      await request(app.getHttpServer())
        .patch(`/api/v1/chores/${CHORE_ID}/archive`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.isActive).toBe(false);
        });

      await request(app.getHttpServer())
        .patch(`/api/v1/chores/${CHORE_ID}/archive`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-timezone', 'America/Lima')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.isActive).toBe(true);
        });
    });
  });

  // ─── DELETE /chores/:id ───────────────────────────────────────────────────────

  describe('DELETE /api/v1/chores/:id', () => {
    it('soft-deletes when there are no logs', async () => {
      const chore = buildChore({ id: CHORE_ID, userId: USER_ID });
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockLogRepo.countByChoreId.mockResolvedValue(0);
      mockChoreRepo.softDelete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/v1/chores/${CHORE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(mockChoreRepo.softDelete).toHaveBeenCalledWith(CHORE_ID);
    });

    it('returns 409 CHRE_001 when the chore has logs', async () => {
      const chore = buildChore({ id: CHORE_ID, userId: USER_ID });
      mockChoreRepo.findById.mockResolvedValue(chore);
      mockLogRepo.countByChoreId.mockResolvedValue(4);

      return request(app.getHttpServer())
        .delete(`/api/v1/chores/${CHORE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409)
        .expect(({ body }) => {
          expect(body.success).toBe(false);
          expect(body.error.code).toBe('CHRE_001');
        });
    });
  });
});
