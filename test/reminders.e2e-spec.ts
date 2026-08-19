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
import { CreateReminderUseCase } from '../src/modules/reminders/application/use-cases/create-reminder.use-case';
import { DeleteReminderUseCase } from '../src/modules/reminders/application/use-cases/delete-reminder.use-case';
import { GetRemindersUseCase } from '../src/modules/reminders/application/use-cases/get-reminders.use-case';
import { UpdateReminderUseCase } from '../src/modules/reminders/application/use-cases/update-reminder.use-case';
import { Reminder } from '../src/modules/reminders/domain/reminder.entity';
import { ReminderRepository } from '../src/modules/reminders/domain/reminder.repository';
import { RemindersController } from '../src/modules/reminders/presentation/reminders.controller';
import { buildUserSettings } from '../src/modules/users/domain/__tests__/user-settings.factory';
import { UserSettingsRepository } from '../src/modules/users/domain/user-settings.repository';

import { buildPinoLoggerProviders } from './helpers/pino-logger-providers';

const TEST_JWT_SECRET = 'e2e-reminders-jwt-secret-min-32!!!!';
const USER_ID = 'e2e-user-uuid-reminders-1';
const REMINDER_ID = '00000000-0000-4000-a000-000000000001';

function buildReminder(
  over: Partial<{ remindDate: string | null; remindTime: string | null }> = {},
) {
  const now = new Date('2026-05-01T00:00:00.000Z');
  return new Reminder(
    REMINDER_ID,
    USER_ID,
    'Llamar al dentista',
    null,
    over.remindDate !== undefined ? over.remindDate : '2026-05-20',
    over.remindTime !== undefined ? over.remindTime : null,
    false,
    null,
    now,
    now,
  );
}

describe('RemindersController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;

  const mockReminderRepo: jest.Mocked<ReminderRepository> = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    deleteById: jest.fn(),
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
      controllers: [RemindersController],
      providers: [
        GetRemindersUseCase,
        CreateReminderUseCase,
        UpdateReminderUseCase,
        DeleteReminderUseCase,
        { provide: ReminderRepository, useValue: mockReminderRepo },
        { provide: UserSettingsRepository, useValue: mockSettingsRepo },

        JwtAccessStrategy,
        { provide: ConfigService, useValue: mockConfigService },

        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

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
      { sub: USER_ID, email: 'reminders-e2e@test.com' },
      { secret: TEST_JWT_SECRET, expiresIn: '15m' },
    );
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsRepo.findByUserId.mockResolvedValue(buildUserSettings({ userId: USER_ID }));
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  describe('POST /reminders', () => {
    it('creates a bare note with no date and no time', async () => {
      mockReminderRepo.save.mockImplementation((r) => Promise.resolve(r));

      const res = await request(app.getHttpServer())
        .post('/api/v1/reminders')
        .set(auth())
        .send({ title: 'Comprar pilas' })
        .expect(201);

      expect(res.body.data.remindDate).toBeNull();
      expect(res.body.data.remindTime).toBeNull();
    });

    it('creates one with a date and a time', async () => {
      mockReminderRepo.save.mockImplementation((r) => Promise.resolve(r));

      const res = await request(app.getHttpServer())
        .post('/api/v1/reminders')
        .set(auth())
        .send({ title: 'Dentista', remindDate: '2026-05-20', remindTime: '15:00' })
        .expect(201);

      expect(res.body.data.remindDate).toBe('2026-05-20');
      expect(res.body.data.remindTime).toBe('15:00');
    });

    it('rejects a time with no date', async () => {
      // The rule the whole model rests on, checked at the wire.
      const res = await request(app.getHttpServer())
        .post('/api/v1/reminders')
        .set(auth())
        .send({ title: 'Dentista', remindTime: '15:00' })
        .expect(422);

      expect(res.body.error.code).toBe('RMDR_008');
      expect(mockReminderRepo.save).not.toHaveBeenCalled();
    });

    // 400, not 422: the DTO's `@Matches` catches the format at the pipe, so
    // it never reaches the domain. RMDR_006/RMDR_007 stay as domain guards for
    // anything that bypasses the DTO — they are not reachable over HTTP.
    it('rejects a malformed time at the validation pipe', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reminders')
        .set(auth())
        .send({ title: 'Dentista', remindDate: '2026-05-20', remindTime: '3pm' })
        .expect(400);
    });

    it('rejects a malformed date at the validation pipe', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reminders')
        .set(auth())
        .send({ title: 'Dentista', remindDate: '20/05/2026' })
        .expect(400);
    });

    it('rejects an empty title', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reminders')
        .set(auth())
        .send({ title: '' })
        .expect(400);
    });
  });

  describe('PATCH /reminders/:id', () => {
    it('clears the time along with the date', async () => {
      mockReminderRepo.findById.mockResolvedValue(
        buildReminder({ remindDate: '2026-05-20', remindTime: '15:00' }),
      );
      mockReminderRepo.save.mockImplementation((r) => Promise.resolve(r));

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reminders/${REMINDER_ID}`)
        .set(auth())
        .send({ remindDate: null })
        .expect(200);

      expect(res.body.data.remindDate).toBeNull();
      expect(res.body.data.remindTime).toBeNull();
    });

    it('refuses to put a time on a reminder that has no date', async () => {
      mockReminderRepo.findById.mockResolvedValue(buildReminder({ remindDate: null }));

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reminders/${REMINDER_ID}`)
        .set(auth())
        .send({ remindTime: '15:00' })
        .expect(422);

      expect(res.body.error.code).toBe('RMDR_008');
    });

    it('stamps completedAt when completed', async () => {
      mockReminderRepo.findById.mockResolvedValue(buildReminder());
      mockReminderRepo.save.mockImplementation((r) => Promise.resolve(r));

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reminders/${REMINDER_ID}`)
        .set(auth())
        .send({ completed: true })
        .expect(200);

      expect(res.body.data.completed).toBe(true);
      expect(res.body.data.completedAt).not.toBeNull();
    });

    it('404s for an unknown id', async () => {
      mockReminderRepo.findById.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reminders/${REMINDER_ID}`)
        .set(auth())
        .send({ title: 'Otra cosa' })
        .expect(404);

      expect(res.body.error.code).toBe('RMDR_001');
    });

    it('403s for a reminder owned by someone else', async () => {
      const foreign = buildReminder();
      (foreign as { userId: string }).userId = 'someone-else';
      mockReminderRepo.findById.mockResolvedValue(foreign);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reminders/${REMINDER_ID}`)
        .set(auth())
        .send({ completed: true })
        .expect(403);

      expect(res.body.error.code).toBe('RMDR_002');
    });
  });

  describe('DELETE /reminders/:id', () => {
    it('deletes one that belongs to the user', async () => {
      mockReminderRepo.findById.mockResolvedValue(buildReminder());

      await request(app.getHttpServer())
        .delete(`/api/v1/reminders/${REMINDER_ID}`)
        .set(auth())
        .expect(204);

      expect(mockReminderRepo.deleteById).toHaveBeenCalledWith(REMINDER_ID);
    });
  });

  describe('GET /reminders', () => {
    it('returns the list', async () => {
      mockReminderRepo.findByUserId.mockResolvedValue([buildReminder()]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/reminders')
        .set(auth())
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Llamar al dentista');
    });

    it('401s without a token', async () => {
      await request(app.getHttpServer()).get('/api/v1/reminders').expect(401);
    });
  });
});
