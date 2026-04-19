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
import { CreateQuickTaskUseCase } from '../src/modules/quick-tasks/application/use-cases/create-quick-task.use-case';
import { DeleteQuickTaskUseCase } from '../src/modules/quick-tasks/application/use-cases/delete-quick-task.use-case';
import { GetQuickTasksUseCase } from '../src/modules/quick-tasks/application/use-cases/get-quick-tasks.use-case';
import { ReorderQuickTasksUseCase } from '../src/modules/quick-tasks/application/use-cases/reorder-quick-tasks.use-case';
import { UpdateQuickTaskUseCase } from '../src/modules/quick-tasks/application/use-cases/update-quick-task.use-case';
import { buildQuickTask } from '../src/modules/quick-tasks/domain/__tests__/quick-task.factory';
import { QuickTaskRepository } from '../src/modules/quick-tasks/domain/quick-task.repository';
import { QuickTasksController } from '../src/modules/quick-tasks/presentation/quick-tasks.controller';
import { buildUserSettings } from '../src/modules/users/domain/__tests__/user-settings.factory';
import { UserSettingsRepository } from '../src/modules/users/domain/user-settings.repository';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-quick-tasks-jwt-secret-min-32!!';
const USER_ID = 'e2e-user-uuid-quick-0001';
const TASK_ID = '00000000-0000-4000-a000-000000000001';

describe('QuickTasksController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockTaskRepo: jest.Mocked<QuickTaskRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    deleteById: jest.fn(),
    deleteCompletedBefore: jest.fn(),
    maxPositionByUserId: jest.fn(),
    updatePositions: jest.fn(),
  };

  const mockSettingsRepo: jest.Mocked<UserSettingsRepository> = {
    findByUserId: jest.fn(),
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
      controllers: [QuickTasksController],
      providers: [
        GetQuickTasksUseCase,
        CreateQuickTaskUseCase,
        UpdateQuickTaskUseCase,
        DeleteQuickTaskUseCase,
        ReorderQuickTasksUseCase,
        { provide: QuickTaskRepository, useValue: mockTaskRepo },
        { provide: UserSettingsRepository, useValue: mockSettingsRepo },

        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },

        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

        ...buildPinoLoggerProviders([
          AllExceptionsFilter.name,
          CreateQuickTaskUseCase.name,
          GetQuickTasksUseCase.name,
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
      { sub: USER_ID, email: 'quick-tasks-e2e@test.com' },
      { secret: TEST_JWT_SECRET, expiresIn: '15m' },
    );
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsRepo.findByUserId.mockResolvedValue(
      buildUserSettings({ userId: USER_ID, timezone: 'UTC' }),
    );
  });

  describe('authentication', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).get('/api/v1/quick-tasks').expect(401);
    });
  });

  describe('GET /quick-tasks', () => {
    it('runs lazy cleanup and returns the list', async () => {
      mockTaskRepo.deleteCompletedBefore.mockResolvedValue(2);
      const surviving = buildQuickTask({ userId: USER_ID, title: 'Pending 1' });
      mockTaskRepo.findByUserId.mockResolvedValue([surviving]);

      return request(app.getHttpServer())
        .get('/api/v1/quick-tasks')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.success).toBe(true);
          expect(body.data).toHaveLength(1);
          expect(body.data[0].title).toBe('Pending 1');
          expect(mockTaskRepo.deleteCompletedBefore).toHaveBeenCalledWith(
            USER_ID,
            expect.any(Date),
          );
        });
    });
  });

  describe('POST /quick-tasks', () => {
    it('creates a task and appends it at position = max + 1', async () => {
      mockTaskRepo.maxPositionByUserId.mockResolvedValue(3);
      mockTaskRepo.save.mockImplementation((t) => Promise.resolve(t));

      return request(app.getHttpServer())
        .post('/api/v1/quick-tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Nueva tarea' })
        .expect(201)
        .expect(({ body }) => {
          expect(body.data.title).toBe('Nueva tarea');
          expect(body.data.position).toBe(4);
          expect(body.data.completed).toBe(false);
        });
    });

    it('returns 400 when title is missing', () => {
      return request(app.getHttpServer())
        .post('/api/v1/quick-tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('returns 400 when title exceeds 120 chars', () => {
      return request(app.getHttpServer())
        .post('/api/v1/quick-tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'a'.repeat(121) })
        .expect(400);
    });
  });

  describe('PATCH /quick-tasks/:id', () => {
    it('marks the task as completed', async () => {
      const existing = buildQuickTask({ id: TASK_ID, userId: USER_ID, completed: false });
      mockTaskRepo.findById.mockResolvedValue(existing);
      mockTaskRepo.save.mockImplementation((t) => Promise.resolve(t));

      return request(app.getHttpServer())
        .patch(`/api/v1/quick-tasks/${TASK_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true })
        .expect(200)
        .expect(({ body }) => {
          expect(body.data.completed).toBe(true);
          expect(body.data.completedAt).not.toBeNull();
        });
    });

    it('returns 404 when the task does not exist', () => {
      mockTaskRepo.findById.mockResolvedValue(null);

      return request(app.getHttpServer())
        .patch(`/api/v1/quick-tasks/${TASK_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Nuevo' })
        .expect(404);
    });

    it('returns 403 when the task belongs to another user', () => {
      const other = buildQuickTask({ id: TASK_ID, userId: 'other-user' });
      mockTaskRepo.findById.mockResolvedValue(other);

      return request(app.getHttpServer())
        .patch(`/api/v1/quick-tasks/${TASK_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Nuevo' })
        .expect(403);
    });
  });

  describe('DELETE /quick-tasks/:id', () => {
    it('hard-deletes and returns 204', async () => {
      const existing = buildQuickTask({ id: TASK_ID, userId: USER_ID });
      mockTaskRepo.findById.mockResolvedValue(existing);
      mockTaskRepo.deleteById.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/api/v1/quick-tasks/${TASK_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204)
        .expect(() => {
          expect(mockTaskRepo.deleteById).toHaveBeenCalledWith(TASK_ID);
        });
    });
  });

  describe('PATCH /quick-tasks/reorder', () => {
    it('renumbers positions 1..N in the provided order', async () => {
      const a = buildQuickTask({ id: '11111111-1111-4111-9111-111111111111', userId: USER_ID });
      const b = buildQuickTask({ id: '22222222-2222-4222-9222-222222222222', userId: USER_ID });
      mockTaskRepo.findByUserId.mockResolvedValue([a, b]);
      mockTaskRepo.updatePositions.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .patch('/api/v1/quick-tasks/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderedIds: [b.id, a.id] })
        .expect(204)
        .expect(() => {
          expect(mockTaskRepo.updatePositions).toHaveBeenCalledWith(USER_ID, [
            { id: b.id, position: 1 },
            { id: a.id, position: 2 },
          ]);
        });
    });

    it('returns 422 when the payload references an unknown id', async () => {
      mockTaskRepo.findByUserId.mockResolvedValue([]);

      return request(app.getHttpServer())
        .patch('/api/v1/quick-tasks/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderedIds: ['33333333-3333-4333-9333-333333333333'] })
        .expect(422);
    });
  });
});
