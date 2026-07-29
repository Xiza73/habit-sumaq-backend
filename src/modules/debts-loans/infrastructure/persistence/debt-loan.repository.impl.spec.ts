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

    it('orders by createdAt ASC then id ASC so the frontend linkedDebts contract is deterministic', async () => {
      await repo.findBySourcePaymentIds(['payment-1']);

      const [, options] = ormRepo.manager.find.mock.calls[0] as [
        unknown,
        { order?: Record<string, unknown> },
      ];
      // Without an explicit ORDER BY, Postgres returns rows in
      // physical/heap order — nondeterministic across VACUUM/updates. The
      // linkedDebts[] array is a frontend-consumed contract, so the order
      // must be stable: createdAt ASC, with id as a tiebreaker when two
      // linked debts share a createdAt (same-transaction split generation).
      expect(options.order).toEqual({ createdAt: 'ASC', id: 'ASC' });
    });
  });

  describe('aggregateByReference — shared-payment LOAN grouping (normalizeReference/unaccent gotcha)', () => {
    // Resolves the slice-1 review gotcha: a LOAN generated by
    // DebtLoanSettlementComposer (sourceMonthlyServicePaymentId set) is
    // persisted via the SAME `save()` path as a manually-created debt
    // (sourceMonthlyServicePaymentId null) — `aggregateByReference` groups
    // purely on `LOWER(unaccent(dl.reference))` + `dl.currency`, with NO
    // filter on `sourceMonthlyServicePaymentId`. This proves a generated
    // LOAN for "José" groups with a manually-created debt for "jose" (or
    // any accent/case variant) through the identical SQL clause — no
    // separate normalization path, no divergence.
    it('runs the exact same LOWER(unaccent(...)) grouping clause regardless of row origin', async () => {
      ormRepo.manager.query.mockResolvedValue([]);

      await repo.aggregateByReference('user-1', 'all');

      const [sql] = ormRepo.manager.query.mock.calls[0] as [string, unknown[]];
      // The grouping clause makes no reference to sourceMonthlyServicePaymentId —
      // it is origin-agnostic by construction.
      expect(sql).toContain('LOWER(unaccent(dl.reference))');
      expect(sql).not.toContain('sourceMonthlyServicePaymentId');
    });

    it('save() persists a composer-generated LOAN (accented reference) through the identical column set as a manual debt (triangulation)', async () => {
      const manualDebt = buildDebtLoan({
        id: 'debt-manual',
        reference: 'jose',
        sourceMonthlyServicePaymentId: null,
      });
      const generatedLoan = buildDebtLoan({
        id: 'debt-generated',
        reference: 'José',
        sourceMonthlyServicePaymentId: 'payment-1',
      });

      ormRepo.manager.save.mockResolvedValueOnce(
        buildOrmRow({ id: 'debt-manual', reference: 'jose', sourceMonthlyServicePaymentId: null }),
      );
      await repo.save(manualDebt);
      const [, manualPayload] = ormRepo.manager.save.mock.calls[0] as [unknown, DebtLoanOrmEntity];

      ormRepo.manager.save.mockResolvedValueOnce(
        buildOrmRow({
          id: 'debt-generated',
          reference: 'José',
          sourceMonthlyServicePaymentId: 'payment-1',
        }),
      );
      await repo.save(generatedLoan);
      const [, generatedPayload] = ormRepo.manager.save.mock.calls[1] as [
        unknown,
        DebtLoanOrmEntity,
      ];

      // Same column SET on both writes (reference stored verbatim, no
      // extra normalized column) — only `sourceMonthlyServicePaymentId`
      // differs. Both rows are later grouped by the exact same
      // `LOWER(unaccent(reference))` SQL expression at read time.
      expect(Object.keys(manualPayload).sort()).toEqual(Object.keys(generatedPayload).sort());
      expect(manualPayload.reference).toBe('jose');
      expect(generatedPayload.reference).toBe('José');
    });
  });
});
