import { DomainException } from '@common/exceptions/domain.exception';
import { type LinkedDebtsGatherer } from '@modules/monthly-services/application/services/linked-debts-gatherer';

import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { GetMonthlyServiceUseCase } from './get-monthly-service.use-case';

describe('GetMonthlyServiceUseCase', () => {
  let useCase: GetMonthlyServiceUseCase;
  let repo: jest.Mocked<MonthlyServiceRepository>;
  let linkedDebtsGatherer: jest.Mocked<Pick<LinkedDebtsGatherer, 'forService'>>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    linkedDebtsGatherer = { forService: jest.fn().mockResolvedValue([]) };
    useCase = new GetMonthlyServiceUseCase(
      repo,
      linkedDebtsGatherer as unknown as LinkedDebtsGatherer,
    );
  });

  it('returns the service when it exists and belongs to the user', async () => {
    const service = buildMonthlyService({ userId: 'user-1' });
    repo.findById.mockResolvedValue(service);

    const result = await useCase.execute(service.id, 'user-1');

    expect(result.service).toBe(service);
  });

  it('throws MONTHLY_SERVICE_NOT_FOUND when the id does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('x', 'user-1')).rejects.toThrow(DomainException);
    await expect(useCase.execute('x', 'user-1')).rejects.toThrow('Servicio mensual no encontrado');
  });

  it('hides the existence of services owned by other users (same error as 404)', async () => {
    const service = buildMonthlyService({ userId: 'other-user' });
    repo.findById.mockResolvedValue(service);

    await expect(useCase.execute(service.id, 'user-1')).rejects.toThrow(
      'Servicio mensual no encontrado',
    );
  });

  it('attaches linkedDebts gathered for the service', async () => {
    const service = buildMonthlyService({ userId: 'user-1' });
    repo.findById.mockResolvedValue(service);
    linkedDebtsGatherer.forService.mockResolvedValue([
      { id: 'debt-1', reference: 'Ana', remainingAmount: 100, status: 'PENDING' },
    ]);

    const result = await useCase.execute(service.id, 'user-1');

    expect(linkedDebtsGatherer.forService).toHaveBeenCalledWith(service.id);
    expect(result.linkedDebts).toEqual([
      { id: 'debt-1', reference: 'Ana', remainingAmount: 100, status: 'PENDING' },
    ]);
  });

  it('linkedDebts is an empty array for a service with no linked debts (triangulation)', async () => {
    const service = buildMonthlyService({ userId: 'user-1' });
    repo.findById.mockResolvedValue(service);
    linkedDebtsGatherer.forService.mockResolvedValue([]);

    const result = await useCase.execute(service.id, 'user-1');

    expect(result.linkedDebts).toEqual([]);
  });
});
