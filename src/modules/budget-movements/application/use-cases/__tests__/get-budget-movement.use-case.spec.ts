import { type DomainException } from '@common/exceptions/domain.exception';

import { buildBudgetMovement } from '../../../domain/__tests__/budget-movement.factory';
import { type BudgetMovementRepository } from '../../../domain/budget-movement.repository';
import { GetBudgetMovementUseCase } from '../get-budget-movement.use-case';

describe('GetBudgetMovementUseCase', () => {
  let repo: jest.Mocked<BudgetMovementRepository>;
  let useCase: GetBudgetMovementUseCase;

  beforeEach(() => {
    repo = {
      findByBudgetId: jest.fn(),
      findById: jest.fn(),
      sumByBudgetId: jest.fn(),
      sumByCurrencyInRange: jest.fn(),
      topCategoriesByCurrencyInRange: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new GetBudgetMovementUseCase(repo);
  });

  it('returns the movement when it exists and belongs to the user', async () => {
    const m = buildBudgetMovement({ userId: 'user-1' });
    repo.findById.mockResolvedValue(m);
    await expect(useCase.execute(m.id, 'user-1')).resolves.toBe(m);
  });

  it('throws BUDGET_MOVEMENT_NOT_FOUND for missing id', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('x', 'user-1')).rejects.toMatchObject({
      code: 'BUDGET_MOVEMENT_NOT_FOUND',
    } satisfies Partial<DomainException>);
  });

  it('throws BUDGET_MOVEMENT_NOT_FOUND when soft-deleted', async () => {
    repo.findById.mockResolvedValue(
      buildBudgetMovement({ userId: 'user-1', deletedAt: new Date() }),
    );
    await expect(useCase.execute('x', 'user-1')).rejects.toMatchObject({
      code: 'BUDGET_MOVEMENT_NOT_FOUND',
    } satisfies Partial<DomainException>);
  });

  it('throws BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER on cross-user access', async () => {
    repo.findById.mockResolvedValue(buildBudgetMovement({ userId: 'someone-else' }));
    await expect(useCase.execute('x', 'user-1')).rejects.toMatchObject({
      code: 'BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER',
    } satisfies Partial<DomainException>);
  });
});
