import { type Currency } from '@common/enums/currency.enum';

import { DebtLoanStatus } from './enums/debt-loan-status.enum';
import { type DebtLoanType } from './enums/debt-loan-type.enum';

/**
 * Domain entity for a debt or a loan. Standalone module per the v1.0.0
 * `accounts-to-modular-finance` refactor — previously these lived as
 * `transactions` rows with `type IN (DEBT, LOAN)`.
 *
 * Semantics (locked in proposal Q1):
 *
 *  - Creating a debt or loan is NEUTRAL on the currency pool (no money
 *    moves at obligation-time).
 *  - Settling in **real-payment mode** (with `currency` arg in the use
 *    case) moves the pool: DEBT settle DEBITS the user's pool, LOAN
 *    settle CREDITS it. The actual delta call lives in the settle use
 *    case; this entity only tracks status + remaining.
 *  - Settling in **informal-close mode** (no currency) just marks SETTLED
 *    without touching the pool. Use case for "we squared up face-to-face
 *    so close the books, no need to record it as a real cash flow".
 *  - Soft-delete via `deletedAt` per CLAUDE.md rule #7.
 */
export class DebtLoan {
  constructor(
    readonly id: string,
    readonly userId: string,
    public type: DebtLoanType,
    public categoryId: string | null,
    public currency: Currency,
    public amount: number,
    public remainingAmount: number,
    public status: DebtLoanStatus,
    public reference: string,
    public description: string | null,
    public date: Date,
    readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  isPending(): boolean {
    return this.status === DebtLoanStatus.PENDING;
  }

  isSettled(): boolean {
    return this.status === DebtLoanStatus.SETTLED;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  /**
   * Apply a partial or full settlement amount. Caller validates that
   * `settledAmount > 0`, `settledAmount <= remainingAmount`, and that
   * the entity is currently PENDING. When the new `remainingAmount`
   * reaches 0, status flips to SETTLED.
   */
  applySettlement(settledAmount: number): void {
    this.remainingAmount = round2(this.remainingAmount - settledAmount);
    if (this.remainingAmount <= 0) {
      this.remainingAmount = 0;
      this.status = DebtLoanStatus.SETTLED;
    }
    this.updatedAt = new Date();
  }

  /**
   * Reverse a previously-applied settlement. Used by the delete path
   * (if we ever need to undo a real-payment) — restores the row to
   * PENDING regardless of its previous status, since reverting a
   * settle by definition makes the obligation outstanding again.
   */
  revertSettlement(settledAmount: number): void {
    this.remainingAmount = round2(this.remainingAmount + settledAmount);
    this.status = DebtLoanStatus.PENDING;
    this.updatedAt = new Date();
  }

  /**
   * Update the editable fields. SETTLED rows are restricted to `amount`
   * edits only; this guard is enforced in the use case, not here.
   */
  update(partial: {
    amount?: number;
    description?: string | null;
    date?: Date;
    categoryId?: string | null;
    reference?: string;
  }): void {
    if (partial.amount !== undefined) this.amount = round2(partial.amount);
    if (partial.description !== undefined) this.description = partial.description;
    if (partial.date !== undefined) this.date = partial.date;
    if (partial.categoryId !== undefined) this.categoryId = partial.categoryId;
    if (partial.reference !== undefined) this.reference = partial.reference;
    this.updatedAt = new Date();
  }
}

/** 2-decimal rounding to keep money math sane across JS floats. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
