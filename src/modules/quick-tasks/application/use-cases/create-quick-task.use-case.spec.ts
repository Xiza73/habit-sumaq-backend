import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';

import { type QuickTaskRepository } from '../../domain/quick-task.repository';

import { CreateQuickTaskUseCase } from './create-quick-task.use-case';

describe('CreateQuickTaskUseCase', () => {
  let useCase: CreateQuickTaskUseCase;
  let mockRepo: jest.Mocked<QuickTaskRepository>;
  let mockLogger: ReturnType<typeof buildMockPinoLogger>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((t) => Promise.resolve(t)),
      deleteById: jest.fn(),
      deleteCompletedBefore: jest.fn(),
      maxPositionByUserId: jest.fn(),
      updatePositions: jest.fn(),
    } as jest.Mocked<QuickTaskRepository>;

    mockLogger = buildMockPinoLogger();
    useCase = new CreateQuickTaskUseCase(mockRepo, mockLogger as unknown as PinoLogger);
  });

  it('appends at position 1 when user has no tasks', async () => {
    mockRepo.maxPositionByUserId.mockResolvedValue(null);

    const result = await useCase.execute('user-1', { title: 'Comprar leche' });

    expect(result.position).toBe(1);
    expect(result.title).toBe('Comprar leche');
    expect(result.description).toBeNull();
    expect(result.completed).toBe(false);
    expect(result.completedAt).toBeNull();
  });

  it('appends one position after the current max', async () => {
    mockRepo.maxPositionByUserId.mockResolvedValue(7);

    const result = await useCase.execute('user-1', { title: 'Llamar a Juan' });

    expect(result.position).toBe(8);
  });

  it('stores description when provided', async () => {
    mockRepo.maxPositionByUserId.mockResolvedValue(null);

    const result = await useCase.execute('user-1', {
      title: 'Pagar recibo',
      description: 'Entra a la app y **paga**',
    });

    expect(result.description).toBe('Entra a la app y **paga**');
  });
});
