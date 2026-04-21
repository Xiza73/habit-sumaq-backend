import { buildMonthlyService } from '../../domain/__tests__/monthly-service.factory';
import { type MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import { ListMonthlyServicesUseCase } from './list-monthly-services.use-case';

describe('ListMonthlyServicesUseCase', () => {
  let useCase: ListMonthlyServicesUseCase;
  let repo: jest.Mocked<MonthlyServiceRepository>;

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findActiveByUserIdAndName: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    } as jest.Mocked<MonthlyServiceRepository>;
    useCase = new ListMonthlyServicesUseCase(repo);
  });

  it('delegates to the repository with includeArchived=false by default', async () => {
    const services = [buildMonthlyService({ userId: 'user-1' })];
    repo.findByUserId.mockResolvedValue(services);

    const result = await useCase.execute('user-1', false);

    expect(result).toEqual(services);
    expect(repo.findByUserId).toHaveBeenCalledWith('user-1', false);
  });

  it('forwards includeArchived=true', async () => {
    repo.findByUserId.mockResolvedValue([]);
    await useCase.execute('user-1', true);
    expect(repo.findByUserId).toHaveBeenCalledWith('user-1', true);
  });
});
