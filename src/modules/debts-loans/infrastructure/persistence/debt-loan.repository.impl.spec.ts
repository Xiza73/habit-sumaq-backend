import { type EntityManager, type Repository } from 'typeorm';

import { Currency } from '@common/enums/currency.enum';

import { buildDebtLoan } from '../../domain/__tests__/debt-loan.factory';
import { DebtLoanStatus } from '../../domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

import { type DebtLoanOrmEntity } from './debt-loan.orm-entity';
import { DebtLoanRepositoryImpl } from './debt-loan.repository.impl';

function buildOrmRow(overrides: Partial<DebtLoanOrmEntity> = {}): DebtLoanOrmEntity {
  const now = new Date('2026-07-28T12:00:00.000Z');
  return {
    id: overrides.id ?? 'debt-1',
    userId: overrides.userId ?? 'user-1',
    type: overrides.type ?? DebtLoanType.LOAN,
    categoryId: overrides.categoryId ?? null,
    currency: overrides.currency ?? Currency.PEN,
    amount: overrides.amount ?? 100,
    remainingAmount: overrides.remainingAmount ?? 100,
    status: overrides.status ?? DebtLoanStatus.PENDING,
    reference: overrides.reference ?? 'Ana',
    description: overrides.description ?? null,
    date: overrides.date ?? now,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    deletedAt: overrides.deletedAt ?? null,
    sourceMonthlyServicePaymentId: overrides.sourceMonthlyServicePaymentId ?? null,
  } as DebtLoanOrmEntity;
}

describe('DebtLoanRepositoryImpl', () => {
  let repo: DebtLoanRepositoryImpl;
  let ormRepo: jest.Mocked<Pick<Repository<DebtLoanOrmEntity>, 'find' | 'findOne'>> & {
    manager: jest.Mocked<Pick<EntityManager, 'save' | 'query' | 'find'>>;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(() => {
    ormRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      manager: { save: jest.fn(), query: jest.fn(), find: jest.fn().mockResolvedValue([]) },
      createQueryBuilder: jest.fn(),
    };
    repo = new DebtLoanRepositoryImpl(ormRepo as unknown as Repository<DebtLoanOrmEntity>);
  });

  describe('save', () => {
    it('persists sourceMonthlyServicePaymentId when set on the domain entity', async () => {
      const debt = buildDebtLoan({
        id: 'debt-1',
        sourceMonthlyServicePaymentId: 'payment-42',
      });
      ormRepo.manager.save.mockResolvedValue(
        buildOrmRow({ id: 'debt-1', sourceMonthlyServicePaymentId: 'payment-42' }),
      );

      await repo.save(debt);

      expect(ormRepo.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ sourceMonthlyServicePaymentId: 'payment-42' }),
      );
    });

    it('persists null sourceMonthlyServicePaymentId for a manually-created debt (triangulation)', async () => {
      const debt = buildDebtLoan({ id: 'debt-2', sourceMonthlyServicePaymentId: null });
      ormRepo.manager.save.mockResolvedValue(
        buildOrmRow({ id: 'debt-2', sourceMonthlyServicePaymentId: null }),
      );

      await repo.save(debt);

      expect(ormRepo.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ sourceMonthlyServicePaymentId: null }),
      );
    });

    it('round-trips sourceMonthlyServicePaymentId through toDomain', async () => {
      const debt = buildDebtLoan({ id: 'debt-1', sourceMonthlyServicePaymentId: 'payment-42' });
      ormRepo.manager.save.mockResolvedValue(
        buildOrmRow({ id: 'debt-1', sourceMonthlyServicePaymentId: 'payment-42' }),
      );

      const saved = await repo.save(debt);

      expect(saved.sourceMonthlyServicePaymentId).toBe('payment-42');
    });
  });

  describe('findBySourcePaymentIds', () => {
    it('returns matching rows mapped to domain entities', async () => {
      ormRepo.manager.find.mockResolvedValue([
        buildOrmRow({ id: 'debt-1', sourceMonthlyServicePaymentId: 'payment-1' }),
        buildOrmRow({ id: 'debt-2', sourceMonthlyServicePaymentId: 'payment-2' }),
      ]);

      const result = await repo.findBySourcePaymentIds(['payment-1', 'payment-2']);

      expect(result).toHaveLength(2);
      expect(result.map((d) => d.id)).toEqual(['debt-1', 'debt-2']);
      expect(result[0].sourceMonthlyServicePaymentId).toBe('payment-1');
    });

    it('returns an empty array without querying when paymentIds is empty (triangulation)', async () => {
      const result = await repo.findBySourcePaymentIds([]);

      expect(result).toEqual([]);
      expect(ormRepo.manager.find).not.toHaveBeenCalled();
    });

    it('uses the caller-supplied manager when provided (transaction passthrough)', async () => {
      const managerFind = jest.fn().mockResolvedValue([]);
      const manager = { find: managerFind } as unknown as EntityManager;

      await repo.findBySourcePaymentIds(['payment-1'], manager);

      expect(managerFind).toHaveBeenCalledTimes(1);
      expect(ormRepo.manager.find).not.toHaveBeenCalled();
    });
  });
});
