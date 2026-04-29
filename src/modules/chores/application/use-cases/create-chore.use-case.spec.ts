import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';

import { type ChoreRepository } from '../../domain/chore.repository';
import { IntervalUnit } from '../../domain/enums/interval-unit.enum';

import { CreateChoreUseCase } from './create-chore.use-case';

import type { CreateChoreDto } from '../dto/create-chore.dto';

describe('CreateChoreUseCase', () => {
  let useCase: CreateChoreUseCase;
  let repo: jest.Mocked<ChoreRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  const userId = 'user-1';
  const baseDto: CreateChoreDto = {
    name: 'Lavar sábanas',
    notes: 'Programa 60°C',
    category: 'Limpieza',
    intervalValue: 2,
    intervalUnit: IntervalUnit.WEEKS,
    startDate: '2026-04-15',
  };

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      softDelete: jest.fn(),
    } as jest.Mocked<ChoreRepository>;

    mockLogger = buildMockPinoLogger();
    useCase = new CreateChoreUseCase(repo, mockLogger as unknown as PinoLogger);
  });

  it('creates a chore with nextDueDate seeded from startDate', async () => {
    const result = await useCase.execute(userId, baseDto);

    expect(result.userId).toBe(userId);
    expect(result.name).toBe('Lavar sábanas');
    expect(result.startDate).toBe('2026-04-15');
    expect(result.nextDueDate).toBe('2026-04-15');
    expect(result.lastDoneDate).toBeNull();
    expect(result.isActive).toBe(true);
    expect(repo.save).toHaveBeenCalled();
  });

  it('persists optional notes and category as null when omitted', async () => {
    const dto: CreateChoreDto = {
      name: 'Vaciar tachos',
      intervalValue: 1,
      intervalUnit: IntervalUnit.DAYS,
      startDate: '2026-04-15',
    };

    const result = await useCase.execute(userId, dto);

    expect(result.notes).toBeNull();
    expect(result.category).toBeNull();
  });

  it('persists provided notes and category strings verbatim', async () => {
    const result = await useCase.execute(userId, baseDto);

    expect(result.notes).toBe('Programa 60°C');
    expect(result.category).toBe('Limpieza');
  });

  it('passes through the intervalValue and intervalUnit unchanged', async () => {
    const dto: CreateChoreDto = {
      name: 'Cambio de aceite',
      intervalValue: 6,
      intervalUnit: IntervalUnit.MONTHS,
      startDate: '2026-04-15',
    };

    const result = await useCase.execute(userId, dto);

    expect(result.intervalValue).toBe(6);
    expect(result.intervalUnit).toBe(IntervalUnit.MONTHS);
  });

  it('emits a structured log on creation', async () => {
    await useCase.execute(userId, baseDto);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'chore.created', userId, name: 'Lavar sábanas' }),
      'chore.created',
    );
  });
});
