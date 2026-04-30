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
import { CreateSectionUseCase } from '../src/modules/tasks/application/use-cases/create-section.use-case';
import { CreateTaskUseCase } from '../src/modules/tasks/application/use-cases/create-task.use-case';
import { DeleteSectionUseCase } from '../src/modules/tasks/application/use-cases/delete-section.use-case';
import { DeleteTaskUseCase } from '../src/modules/tasks/application/use-cases/delete-task.use-case';
import { ListSectionsUseCase } from '../src/modules/tasks/application/use-cases/list-sections.use-case';
import { ListTasksUseCase } from '../src/modules/tasks/application/use-cases/list-tasks.use-case';
import { ReorderSectionsUseCase } from '../src/modules/tasks/application/use-cases/reorder-sections.use-case';
import { ReorderTasksUseCase } from '../src/modules/tasks/application/use-cases/reorder-tasks.use-case';
import { UpdateSectionUseCase } from '../src/modules/tasks/application/use-cases/update-section.use-case';
import { UpdateTaskUseCase } from '../src/modules/tasks/application/use-cases/update-task.use-case';
import { makeSection } from '../src/modules/tasks/domain/__tests__/section.factory';
import { makeTask } from '../src/modules/tasks/domain/__tests__/task.factory';
import { SectionRepository } from '../src/modules/tasks/domain/section.repository';
import { TaskRepository } from '../src/modules/tasks/domain/task.repository';
import { SectionsController } from '../src/modules/tasks/presentation/sections.controller';
import { TasksController } from '../src/modules/tasks/presentation/tasks.controller';
import { UserSettingsRepository } from '../src/modules/users/domain/user-settings.repository';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-tasks-jwt-secret-min-32-chars-aa';
const USER_ID = 'e2e-user-uuid-tasks-0001';
const SEC_ID_1 = '00000000-0000-4000-a000-000000000031';
const SEC_ID_2 = '00000000-0000-4000-a000-000000000032';
const TASK_ID_1 = '00000000-0000-4000-b000-000000000031';
const TASK_ID_2 = '00000000-0000-4000-b000-000000000032';

describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockSectionRepo: jest.Mocked<SectionRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    deleteById: jest.fn(),
    maxPositionByUserId: jest.fn(),
    updatePositions: jest.fn(),
  };

  const mockTaskRepo: jest.Mocked<TaskRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    findBySectionId: jest.fn(),
    save: jest.fn(),
    deleteById: jest.fn(),
    deleteCompletedBefore: jest.fn(),
    maxPositionInSection: jest.fn(),
    updatePositions: jest.fn(),
  };

  const mockSettingsRepo = {
    findByUserId: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<UserSettingsRepository>;

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
      controllers: [SectionsController, TasksController],
      providers: [
        ListSectionsUseCase,
        CreateSectionUseCase,
        UpdateSectionUseCase,
        DeleteSectionUseCase,
        ReorderSectionsUseCase,
        ListTasksUseCase,
        CreateTaskUseCase,
        UpdateTaskUseCase,
        DeleteTaskUseCase,
        ReorderTasksUseCase,
        { provide: SectionRepository, useValue: mockSectionRepo },
        { provide: TaskRepository, useValue: mockTaskRepo },
        { provide: UserSettingsRepository, useValue: mockSettingsRepo },
        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

        ...buildPinoLoggerProviders([
          AllExceptionsFilter.name,
          DeleteSectionUseCase.name,
          ListTasksUseCase.name,
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
    mockSectionRepo.save.mockImplementation((s) => Promise.resolve(s));
    mockSectionRepo.deleteById.mockResolvedValue(undefined);
    mockTaskRepo.save.mockImplementation((t) => Promise.resolve(t));
    mockTaskRepo.deleteById.mockResolvedValue(undefined);
    mockTaskRepo.deleteCompletedBefore.mockResolvedValue(0);
    mockTaskRepo.findByUserId.mockResolvedValue([]);
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────────

  it('returns 401 without a token (sections)', () =>
    request(app.getHttpServer()).get('/api/v1/tasks/sections').expect(401));

  it('returns 401 without a token (tasks)', () =>
    request(app.getHttpServer()).get('/api/v1/tasks').expect(401));

  // ─── Sections ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/tasks/sections', () => {
    it('creates a section at end (max+1)', async () => {
      mockSectionRepo.maxPositionByUserId.mockResolvedValue(2);
      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Personal', color: '#FF6B35' })
        .expect(201);
      expect(res.body.data.name).toBe('Personal');
      expect(res.body.data.position).toBe(3);
      expect(res.body.data.color).toBe('#FF6B35');
    });

    it('rejects invalid color (not #RRGGBB)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/tasks/sections')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad', color: 'red' })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/tasks/sections/:id', () => {
    it('updates name', async () => {
      const section = makeSection({ id: SEC_ID_1, userId: USER_ID, name: 'Old' });
      mockSectionRepo.findById.mockResolvedValue(section);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/sections/${SEC_ID_1}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New' })
        .expect(200);
      expect(res.body.data.name).toBe('New');
    });

    it('returns 404 for cross-user access', async () => {
      mockSectionRepo.findById.mockResolvedValue(makeSection({ userId: 'someone-else' }));
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/sections/${SEC_ID_1}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X' })
        .expect(404);
      expect(res.body.error.code).toBe('TSK_001');
    });
  });

  describe('DELETE /api/v1/tasks/sections/:id', () => {
    it('cascade-deletes the section (FK handles task cleanup)', async () => {
      mockSectionRepo.findById.mockResolvedValue(makeSection({ id: SEC_ID_1, userId: USER_ID }));
      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/sections/${SEC_ID_1}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
      expect(mockSectionRepo.deleteById).toHaveBeenCalledWith(SEC_ID_1);
    });
  });

  describe('PATCH /api/v1/tasks/sections/reorder', () => {
    it('renumbers positions 1..N', async () => {
      mockSectionRepo.findByUserId.mockResolvedValue([
        makeSection({ id: SEC_ID_1, userId: USER_ID }),
        makeSection({ id: SEC_ID_2, userId: USER_ID }),
      ]);
      await request(app.getHttpServer())
        .patch('/api/v1/tasks/sections/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderedIds: [SEC_ID_2, SEC_ID_1] })
        .expect(204);
      expect(mockSectionRepo.updatePositions).toHaveBeenCalledWith(USER_ID, [
        { id: SEC_ID_2, position: 1 },
        { id: SEC_ID_1, position: 2 },
      ]);
    });

    it('rejects unknown ids', async () => {
      mockSectionRepo.findByUserId.mockResolvedValue([
        makeSection({ id: SEC_ID_1, userId: USER_ID }),
      ]);
      const res = await request(app.getHttpServer())
        .patch('/api/v1/tasks/sections/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderedIds: [SEC_ID_1, 'aaaaaaaa-aaaa-4000-aaaa-aaaaaaaaaaaa'] })
        .expect(422);
      expect(res.body.error.code).toBe('TSK_004');
    });
  });

  // ─── Tasks ────────────────────────────────────────────────────────────────────

  describe('POST /api/v1/tasks', () => {
    it('creates a task at end of section', async () => {
      mockSectionRepo.findById.mockResolvedValue(makeSection({ id: SEC_ID_1, userId: USER_ID }));
      mockTaskRepo.maxPositionInSection.mockResolvedValue(1);
      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ sectionId: SEC_ID_1, title: 'Llamar al banco' })
        .expect(201);
      expect(res.body.data.title).toBe('Llamar al banco');
      expect(res.body.data.position).toBe(2);
      expect(res.body.data.completed).toBe(false);
    });

    it('returns 404 when section belongs to another user', async () => {
      mockSectionRepo.findById.mockResolvedValue(makeSection({ userId: 'someone-else' }));
      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ sectionId: SEC_ID_1, title: 'X' })
        .expect(404);
      expect(res.body.error.code).toBe('TSK_001');
    });
  });

  describe('PATCH /api/v1/tasks/:id', () => {
    it('toggles completed (sets completedAt)', async () => {
      const task = makeTask({ id: TASK_ID_1, userId: USER_ID, completed: false });
      mockTaskRepo.findById.mockResolvedValue(task);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${TASK_ID_1}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true })
        .expect(200);
      expect(res.body.data.completed).toBe(true);
      expect(res.body.data.completedAt).not.toBeNull();
    });

    it('moves task to a new section (placed at end)', async () => {
      const task = makeTask({
        id: TASK_ID_1,
        userId: USER_ID,
        sectionId: SEC_ID_1,
        position: 1,
      });
      mockTaskRepo.findById.mockResolvedValue(task);
      mockSectionRepo.findById.mockResolvedValue(makeSection({ id: SEC_ID_2, userId: USER_ID }));
      mockTaskRepo.maxPositionInSection.mockResolvedValue(2);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${TASK_ID_1}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sectionId: SEC_ID_2 })
        .expect(200);
      expect(res.body.data.sectionId).toBe(SEC_ID_2);
      expect(res.body.data.position).toBe(3);
    });
  });

  describe('PATCH /api/v1/tasks/reorder', () => {
    it('reorders tasks within a section', async () => {
      mockSectionRepo.findById.mockResolvedValue(makeSection({ id: SEC_ID_1, userId: USER_ID }));
      mockTaskRepo.findBySectionId.mockResolvedValue([
        makeTask({ id: TASK_ID_1, sectionId: SEC_ID_1 }),
        makeTask({ id: TASK_ID_2, sectionId: SEC_ID_1 }),
      ]);
      await request(app.getHttpServer())
        .patch('/api/v1/tasks/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ sectionId: SEC_ID_1, orderedIds: [TASK_ID_2, TASK_ID_1] })
        .expect(204);
      expect(mockTaskRepo.updatePositions).toHaveBeenCalledWith([
        { id: TASK_ID_2, position: 1 },
        { id: TASK_ID_1, position: 2 },
      ]);
    });
  });

  describe('GET /api/v1/tasks (lazy weekly cleanup)', () => {
    it('runs cleanup before returning the list', async () => {
      mockTaskRepo.deleteCompletedBefore.mockResolvedValue(2);
      mockTaskRepo.findByUserId.mockResolvedValue([makeTask({ userId: USER_ID })]);
      const res = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(mockTaskRepo.deleteCompletedBefore).toHaveBeenCalled();
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    it('hard-deletes a task', async () => {
      mockTaskRepo.findById.mockResolvedValue(makeTask({ id: TASK_ID_1, userId: USER_ID }));
      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${TASK_ID_1}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
      expect(mockTaskRepo.deleteById).toHaveBeenCalledWith(TASK_ID_1);
    });
  });
});
