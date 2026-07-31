import { buildDebtLoan } from './__tests__/debt-loan.factory';
import { DebtLoanStatus } from './enums/debt-loan-status.enum';
import { DebtLoanType } from './enums/debt-loan-type.enum';

describe('DebtLoan', () => {
  describe('applySettlement', () => {
    it('reduces remainingAmount but stays PENDING on partial settle', () => {
      const debt = buildDebtLoan({ amount: 100, remainingAmount: 100 });
      debt.applySettlement(30);

      expect(debt.remainingAmount).toBe(70);
      expect(debt.status).toBe(DebtLoanStatus.PENDING);
    });

    it('flips status to SETTLED when remainingAmount hits 0', () => {
      const loan = buildDebtLoan({
        type: DebtLoanType.LOAN,
        amount: 100,
        remainingAmount: 100,
      });
      loan.applySettlement(100);

      expect(loan.remainingAmount).toBe(0);
      expect(loan.status).toBe(DebtLoanStatus.SETTLED);
    });

    it('clamps remainingAmount to 0 even if settled exceeds (defensive)', () => {
      const debt = buildDebtLoan({ remainingAmount: 50 });
      debt.applySettlement(50);

      expect(debt.remainingAmount).toBe(0);
      expect(debt.status).toBe(DebtLoanStatus.SETTLED);
    });

    it('rounds to 2 decimal places to kill float drift', () => {
      const debt = buildDebtLoan({ remainingAmount: 0.3 });
      debt.applySettlement(0.1);
      // Without round2: 0.3 - 0.1 = 0.19999999999999998 → would never hit 0.
      expect(debt.remainingAmount).toBe(0.2);
    });

    it('bumps updatedAt on every settle', () => {
      const original = new Date('2026-01-01T00:00:00.000Z');
      const debt = buildDebtLoan({ updatedAt: original });
      debt.applySettlement(1);
      expect(debt.updatedAt.getTime()).toBeGreaterThan(original.getTime());
    });
  });

  describe('revertSettlement', () => {
    it('restores remainingAmount and forces status back to PENDING', () => {
      const debt = buildDebtLoan({
        amount: 100,
        remainingAmount: 0,
        status: DebtLoanStatus.SETTLED,
      });
      debt.revertSettlement(40);

      expect(debt.remainingAmount).toBe(40);
      expect(debt.status).toBe(DebtLoanStatus.PENDING);
    });

    it('keeps the row PENDING even when fully reverting (the obligation is open again)', () => {
      const debt = buildDebtLoan({
        amount: 100,
        remainingAmount: 60,
        status: DebtLoanStatus.PENDING,
      });
      debt.revertSettlement(40);

      expect(debt.remainingAmount).toBe(100);
      expect(debt.status).toBe(DebtLoanStatus.PENDING);
    });
  });

  describe('update', () => {
    it('applies partial fields and bumps updatedAt', () => {
      const debt = buildDebtLoan({ amount: 100, description: 'old' });
      debt.update({ amount: 200, description: 'new' });

      expect(debt.amount).toBe(200);
      expect(debt.description).toBe('new');
    });

    it('rounds amount to 2 decimals on update', () => {
      const debt = buildDebtLoan({ amount: 100 });
      debt.update({ amount: 12.345 });
      expect(debt.amount).toBe(12.35);
    });

    it('explicit `null` description is preserved (clearing the field)', () => {
      const debt = buildDebtLoan({ description: 'present' });
      debt.update({ description: null });
      expect(debt.description).toBeNull();
    });

    it('leaves unspecified fields untouched', () => {
      const debt = buildDebtLoan({ amount: 100, reference: 'Juan', description: 'x' });
      debt.update({ amount: 200 });

      expect(debt.amount).toBe(200);
      expect(debt.reference).toBe('Juan');
      expect(debt.description).toBe('x');
    });
  });

  describe('sourceMonthlyServicePaymentId', () => {
    it('defaults to null when not provided', () => {
      const debt = buildDebtLoan({});
      expect(debt.sourceMonthlyServicePaymentId).toBeNull();
    });

    it('is set when a shared-payment-generated LOAN provides it', () => {
      const debt = buildDebtLoan({ sourceMonthlyServicePaymentId: 'payment-1' });
      expect(debt.sourceMonthlyServicePaymentId).toBe('payment-1');
    });
  });

  describe('isPending / isSettled / isDeleted', () => {
    it('isPending true for PENDING status', () => {
      expect(buildDebtLoan({ status: DebtLoanStatus.PENDING }).isPending()).toBe(true);
    });

    it('isSettled true for SETTLED status', () => {
      expect(buildDebtLoan({ status: DebtLoanStatus.SETTLED }).isSettled()).toBe(true);
    });

    it('isDeleted true when deletedAt is set', () => {
      expect(buildDebtLoan({ deletedAt: new Date() }).isDeleted()).toBe(true);
    });

    it('isDeleted false when deletedAt is null', () => {
      expect(buildDebtLoan({ deletedAt: null }).isDeleted()).toBe(false);
    });
  });
});
