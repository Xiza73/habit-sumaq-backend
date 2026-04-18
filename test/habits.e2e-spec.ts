/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';

import cookieParser from 'cookie-parser';
import { getLoggerToken } from 'nestjs-pino';
import request from 'supertest';

import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor';
import { JwtAccessStrategy } from '../src/modules/auth/infrastructure/strategies/jwt-access.strategy';
import { ArchiveHabitUseCase } from '../src/modules/habits/application/use-cases/archive-habit.use-case';
import { CreateHabitUseCase } from '../src/modules/habits/application/use-cases/create-habit.use-case';
import { DeleteHabitUseCase } from '../src/modules/habits/application/use-cases/delete-habit.use-case';
import { GetDailySummaryUseCase } from '../src/modules/habits/application/use-cases/get-daily-summary.use-case';
import { GetHabitByIdUseCase } from '../src/modules/habits/application/use-cases/get-habit-by-id.use-case';
import { GetHabitLogsUseCase } from '../src/modules/habits/application/use-cases/get-habit-logs.use-case';
import { GetHabitsUseCase } from '../src/modules/habits/application/use-cases/get-habits.use-case';
import { LogHabitUseCase } from '../src/modules/habits/application/use-cases/log-habit.use-case';
import { UpdateHabitUseCase } from '../src/modules/habits/application/use-cases/update-habit.use-case';
import { buildHabit } from '../src/modules/habits/domain/__tests__/habit.factory';
import { buildHabitLog } from '../src/modules/habits/domain/__tests__/habit-log.factory';
import { HabitFrequency } from '../src/modules/habits/domain/enums/habit-frequency.enum';
import { HabitRepository } from '../src/modules/habits/domain/habit.repository';
import { HabitLogRepository } from '../src/modules/habits/domain/habit-log.repository';
import { HabitsController } from '../src/modules/habits/presentation/habits.controller';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-habits-jwt-secret-min-32-chars!!';
const USER_ID = 'e2e-user-uuid-habits-0001';
const PAST_DATE = '2026-01-15';
const FUTURE_DATE = '2099-12-31';

type LoggerMock = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  trace: jest.Mock;
  fatal: jest.Mock;
  setContext: jest.Mock;
};

const createLoggerMock = (): LoggerMock => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  setContext: jest.fn(),
});

describe('HabitsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockHabitRepo: jest.Mocked<HabitRepository> = {
    findByUserId: jest.fn(),
    findByUserIdAndName: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockHabitLogRepo: jest.Mocked<HabitLogRepository> = {
    findByHabitIdAndDate: jest.fn(),
    findByHabitId: jest.fn(),
    findByUserIdAndDate: jest.fn(),
    findCompletedByHabitIdSince: jest.fn(),
    findByHabitIdAndDateRange: jest.fn(),
    save: jest.fn(),
    softDeleteByHabitId: jest.fn(),
  };

  const mockCreateLogger = createLoggerMock();
  const mockLogLogger = createLoggerMock();

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
      controllers: [HabitsController],
      providers: [
        CreateHabitUseCase,
        GetHabitsUseCase,
        GetHabitByIdUseCase,
        UpdateHabitUseCase,
        ArchiveHabitUseCase,
        DeleteHabitUseCase,
        LogHabitUseCase,
        GetHabitLogsUseCase,
        GetDailySummaryUseCase,
        { provide: HabitRepository, useValue: mockHabitRepo },
        { provide: HabitLogRepository, useValue: mockHabitLogRepo },
        { provide: getLoggerToken(CreateHabitUseCase.name), useValue: mockCreateLogger },
        { provide: getLoggerToken(LogHabitUseCase.name), useValue: mockLogLogger },

        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },

        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

        // PinoLogger tokens for filters (use-case tokens provided explicitly above)
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
      { sub: USER_ID, email: 'habits-e2e@test.com' },
      { secret: TEST_JWT_SECRET, expiresIn: '15m' },
    );
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  // ─── Authentication ────────────────────────────────────────────────────────────

  describe('authentication', () => {
    it('should return 401 on any endpoint without a token', () => {
      return request(app.getHttpServer()).get('/api/v1/habits').expect(401);
    });
  });

  // ─── POST /habits ──────────────────────────────────────────────────────────────

  describe('POST /api/v1/habits', () => {
    const validBody = {
      name: 'Tomar agua',
      frequency: HabitFrequency.DAILY,
      targetCount: 8,
    };

    it('should create a habit and return 201', async () => {
      const habit = buildHabit({ userId: USER_ID, name: 'Tomar agua', targetCount: 8 });
      mockHabitRepo.findByUserIdAndName.mockResolvedValue(null);
      mockHabitRepo.save.mockResolvedValue(habit);

      return request(app.getHttpServer())
        .post('/api/v1/habits')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody)
        .expect(201)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.name).toBe('Tomar agua');
          expect(body.data.userId).toBe(USER_ID);
          expect(body.data).not.toHaveProperty('deletedAt');
        });
    });

    it('should return 409 when name is already taken', async () => {
      mockHabitRepo.findByUserIdAndName.mockResolvedValue(
        buildHabit({ userId: USER_ID, name: 'Tomar agua' }),
      );

      return request(app.getHttpServer())
        .post('/api/v1/habits')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody)
        .expect(409);
    });

    it('should return 400 when required fields are missing', () => {
      return request(app.getHttpServer())
        .post('/api/v1/habits')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Solo nombre' })
        .expect(400);
    });

    it('should return 400 when targetCount is 0 (class-validator @Min(1) fires before domain)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/habits')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validBody, targetCount: 0 })
        .expect(400);
    });
  });

  // ─── GET /habits ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/habits', () => {
    it('should return 200 with an empty list', async () => {
      mockHabitRepo.findByUserId.mockResolvedValue([]);

      return request(app.getHttpServer())
        .get('/api/v1/habits')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toEqual([]);
        });
    });

    it('should pass includeArchived query to repository', async () => {
      mockHabitRepo.findByUserId.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/habits?includeArchived=true')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .expect(200);

      expect(mockHabitRepo.findByUserId).toHaveBeenCalledWith(USER_ID, true);
    });
  });

  // ─── GET /habits/daily ─────────────────────────────────────────────────────────

  describe('GET /api/v1/habits/daily', () => {
    it('should return 200 with daily summary without date param', async () => {
      mockHabitRepo.findByUserId.mockResolvedValue([]);

      return request(app.getHttpServer())
        .get('/api/v1/habits/daily')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(Array.isArray(body.data)).toBe(true);
        });
    });

    it('should return 200 with daily summary for a specific date', async () => {
      mockHabitRepo.findByUserId.mockResolvedValue([]);

      return request(app.getHttpServer())
        .get(`/api/v1/habits/daily?date=${PAST_DATE}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .expect(200);
    });
  });

  // ─── GET /habits/:id ───────────────────────────────────────────────────────────

  describe('GET /api/v1/habits/:id', () => {
    it('should return 200 with habit and stats', async () => {
      const habit = buildHabit({ userId: USER_ID });
      mockHabitRepo.findById.mockResolvedValue(habit);
      mockHabitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);
      mockHabitLogRepo.findCompletedByHabitIdSince.mockResolvedValue([]);
      mockHabitLogRepo.findByHabitIdAndDateRange.mockResolvedValue([]);

      return request(app.getHttpServer())
        .get(`/api/v1/habits/${habit.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.id).toBe(habit.id);
        });
    });

    it('should return 404 when habit does not exist', async () => {
      mockHabitRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/api/v1/habits/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .expect(404);
    });

    it('should return 403 when habit belongs to another user', async () => {
      const habit = buildHabit({ userId: 'another-user-id' });
      mockHabitRepo.findById.mockResolvedValue(habit);

      return request(app.getHttpServer())
        .get(`/api/v1/habits/${habit.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .expect(403);
    });
  });

  // ─── PATCH /habits/:id ─────────────────────────────────────────────────────────

  describe('PATCH /api/v1/habits/:id', () => {
    it('should update the habit and return 200', async () => {
      const habit = buildHabit({ userId: USER_ID, name: 'Old' });
      mockHabitRepo.findById.mockResolvedValue(habit);
      mockHabitRepo.findByUserIdAndName.mockResolvedValue(null);
      mockHabitRepo.save.mockImplementation((h) => Promise.resolve(h));

      return request(app.getHttpServer())
        .patch(`/api/v1/habits/${habit.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.name).toBe('New');
        });
    });

    it('should return 404 when habit does not exist', async () => {
      mockHabitRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .patch('/api/v1/habits/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New' })
        .expect(404);
    });

    it('should return 409 when new name is already taken', async () => {
      const habit = buildHabit({ userId: USER_ID, name: 'Old' });
      mockHabitRepo.findById.mockResolvedValue(habit);
      mockHabitRepo.findByUserIdAndName.mockResolvedValue(
        buildHabit({ userId: USER_ID, name: 'Taken' }),
      );

      return request(app.getHttpServer())
        .patch(`/api/v1/habits/${habit.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Taken' })
        .expect(409);
    });
  });

  // ─── PATCH /habits/:id/archive ─────────────────────────────────────────────────

  describe('PATCH /api/v1/habits/:id/archive', () => {
    it('should archive an active habit and return 200', async () => {
      const habit = buildHabit({ userId: USER_ID, isArchived: false });
      mockHabitRepo.findById.mockResolvedValue(habit);
      mockHabitRepo.save.mockImplementation((h) => Promise.resolve(h));

      return request(app.getHttpServer())
        .patch(`/api/v1/habits/${habit.id}/archive`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.isArchived).toBe(true);
        });
    });

    it('should return 404 when habit does not exist', async () => {
      mockHabitRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .patch('/api/v1/habits/non-existent-id/archive')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ─── DELETE /habits/:id ────────────────────────────────────────────────────────

  describe('DELETE /api/v1/habits/:id', () => {
    it('should soft delete the habit (logs first, then habit) and return 200', async () => {
      const habit = buildHabit({ userId: USER_ID });
      mockHabitRepo.findById.mockResolvedValue(habit);
      mockHabitLogRepo.softDeleteByHabitId.mockResolvedValue(undefined);
      mockHabitRepo.softDelete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/api/v1/habits/${habit.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toBeNull();
        });

      expect(mockHabitLogRepo.softDeleteByHabitId).toHaveBeenCalledWith(habit.id);
      expect(mockHabitRepo.softDelete).toHaveBeenCalledWith(habit.id);
    });

    it('should return 404 when habit does not exist', async () => {
      mockHabitRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .delete('/api/v1/habits/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ─── POST /habits/:id/logs ─────────────────────────────────────────────────────

  describe('POST /api/v1/habits/:id/logs', () => {
    it('should create a new log and return 201', async () => {
      const habit = buildHabit({ userId: USER_ID, targetCount: 8 });
      mockHabitRepo.findById.mockResolvedValue(habit);
      mockHabitLogRepo.findByHabitIdAndDate.mockResolvedValue(null);
      mockHabitLogRepo.save.mockImplementation((l) => Promise.resolve(l));

      return request(app.getHttpServer())
        .post(`/api/v1/habits/${habit.id}/logs`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .send({ date: PAST_DATE, count: 5 })
        .expect(201)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data.habitId).toBe(habit.id);
          expect(body.data.count).toBe(5);
        });
    });

    it('should update existing log on upsert and return 201', async () => {
      const habit = buildHabit({ userId: USER_ID, targetCount: 8 });
      const existingLog = buildHabitLog({
        habitId: habit.id,
        userId: USER_ID,
        date: PAST_DATE,
        count: 3,
      });
      mockHabitRepo.findById.mockResolvedValue(habit);
      mockHabitLogRepo.findByHabitIdAndDate.mockResolvedValue(existingLog);
      mockHabitLogRepo.save.mockImplementation((l) => Promise.resolve(l));

      return request(app.getHttpServer())
        .post(`/api/v1/habits/${habit.id}/logs`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .send({ date: PAST_DATE, count: 8, note: 'Updated!' })
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.count).toBe(8);
          expect(body.data.completed).toBe(true);
        });
    });

    it('should return 404 when habit does not exist', async () => {
      mockHabitRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post('/api/v1/habits/non-existent-id/logs')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .send({ date: PAST_DATE, count: 1 })
        .expect(404);
    });

    it('should return 422 when habit is archived', async () => {
      const habit = buildHabit({ userId: USER_ID, isArchived: true });
      mockHabitRepo.findById.mockResolvedValue(habit);

      return request(app.getHttpServer())
        .post(`/api/v1/habits/${habit.id}/logs`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .send({ date: PAST_DATE, count: 1 })
        .expect(422)
        .expect(({ body }) => {
          expect(body.error.code).toBe('HAB_003');
        });
    });

    it('should return 422 when date is in the future', async () => {
      const habit = buildHabit({ userId: USER_ID });
      mockHabitRepo.findById.mockResolvedValue(habit);

      return request(app.getHttpServer())
        .post(`/api/v1/habits/${habit.id}/logs`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Timezone', 'UTC')
        .send({ date: FUTURE_DATE, count: 1 })
        .expect(422)
        .expect(({ body }) => {
          expect(body.error.code).toBe('HAB_004');
        });
    });
  });

  // ─── GET /habits/:id/logs ──────────────────────────────────────────────────────

  describe('GET /api/v1/habits/:id/logs', () => {
    it('should return 200 with paginated logs', async () => {
      const habit = buildHabit({ userId: USER_ID });
      const logs = [
        buildHabitLog({ habitId: habit.id, userId: USER_ID, date: PAST_DATE }),
        buildHabitLog({ habitId: habit.id, userId: USER_ID, date: '2026-01-14' }),
      ];
      mockHabitRepo.findById.mockResolvedValue(habit);
      mockHabitLogRepo.findByHabitId.mockResolvedValue({ data: logs, total: 2 });

      return request(app.getHttpServer())
        .get(`/api/v1/habits/${habit.id}/logs`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toHaveLength(2);
          expect(body.meta.total).toBe(2);
          expect(body.meta.totalPages).toBe(1);
        });
    });

    it('should return 200 with empty list when no logs exist', async () => {
      const habit = buildHabit({ userId: USER_ID });
      mockHabitRepo.findById.mockResolvedValue(habit);
      mockHabitLogRepo.findByHabitId.mockResolvedValue({ data: [], total: 0 });

      return request(app.getHttpServer())
        .get(`/api/v1/habits/${habit.id}/logs`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.data).toEqual([]);
          expect(body.meta.total).toBe(0);
        });
    });
  });
});
