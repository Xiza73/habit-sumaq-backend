import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { type EntityManager } from 'typeorm';

import { type Currency } from '@common/enums/currency.enum';
import { CurrencyPoolService } from '@modules/currency-pools/application/currency-pool.service';

import { DebtLoan } from '../../domain/debt-loan.entity';
import { DebtLoanRepository } from '../../domain/debt-loan.repository';
import { DebtLoanPayment } from '../../domain/debt-loan-payment.entity';
import { DebtLoanPaymentRepository } from '../../domain/debt-loan-payment.repository';
import { DebtLoanStatus } from '../../domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../domain/enums/debt-loan-type.enum';

export interface CreateLinkedDebtLoanInput {
  userId: string;
  reference: string;
  currency: Currency;
  amount: number;
  sourceMonthlyServicePaymentId: string;
  /**
   * Human-readable origin label for the generated `LOAN`, e.g.
   * `"Netflix · 2026-07"` (`{service.name} · {period}"`). Built by the
   * caller (`CreateMonthlyServicePaymentUseCase`, which has `service` and
   * `period` in scope) — this composer stays agnostic of the
   * monthly-services domain. Optional/`null` for callers that don't have
   * an origin to describe.
   */
  description?: string | null;
}

/**
 * Composes `DebtLoan` create (+ optional immediate real-payment settle)
 * strictly on a CALLER-SUPPLIED `EntityManager`. Used by
 * `CreateMonthlyServicePaymentUseCase` (shared-service-payments slice 2)
 * to generate one `LOAN` per participant INSIDE the same
 * `dataSource.transaction()` the payment itself uses.
 *
 * CRITICAL invariant: this service NEVER opens its own transaction (no
 * `DataSource` dependency at all). Every method requires the caller to
 * pass the `manager` it wants writes threaded through. This is why it
 * exists instead of reusing `CreateDebtLoanUseCase` /
 * `SettleDebtLoanUseCase` directly — `SettleDebtLoanUseCase.execute()`
 * opens its OWN `dataSource.transaction()`, which would nest a second
 * transaction inside the payment's if called from there (partial-state /
 * deadlock risk). See design decision "How settle composes inside the
 * pay tx".
 *
 * Reuses the exact same three primitives the existing use cases use —
 * `DebtLoanRepository.save`, `DebtLoanPaymentRepository.create`,
 * `CurrencyPoolService.applyDelta` — all threaded through `manager`, so
 * the money math and audit trail stay identical to a manual settle.
 */
@Injectable()
export class DebtLoanSettlementComposer {
  constructor(
    private readonly repo: DebtLoanRepository,
    private readonly paymentRepo: DebtLoanPaymentRepository,
    private readonly poolService: CurrencyPoolService,
  ) {}

  /**
   * Creates a PENDING `LOAN` linked to `sourceMonthlyServicePaymentId`.
   * Pool-neutral (same semantics as `CreateDebtLoanUseCase` — creating an
   * obligation never moves money) — the caller settles it later via
   * `createAndSettleLinked` (same call) or the regular
   * `POST /debts/:id/settle` endpoint.
   */
  async createLinked(manager: EntityManager, input: CreateLinkedDebtLoanInput): Promise<DebtLoan> {
    const now = new Date();
    const debt = new DebtLoan(
      randomUUID(),
      input.userId,
      DebtLoanType.LOAN,
      null,
      input.currency,
      input.amount,
      input.amount,
      DebtLoanStatus.PENDING,
      input.reference,
      input.description ?? null,
      now,
      now,
      now,
      null,
      input.sourceMonthlyServicePaymentId,
    );
    return this.repo.save(debt, manager);
  }

  /**
   * Creates the LOAN (via `createLinked`) and immediately applies a
   * real-payment settlement for the FULL amount, all on `manager` —
   * replicates exactly what `SettleDebtLoanUseCase` does for a LOAN
   * real-payment settle: `applySettlement` → `save` → payment-history
   * row → positive pool delta (LOAN settle = collect).
   */
  async createAndSettleLinked(
    manager: EntityManager,
    input: CreateLinkedDebtLoanInput,
  ): Promise<DebtLoan> {
    const created = await this.createLinked(manager, input);

    created.applySettlement(input.amount);
    const settled = await this.repo.save(created, manager);

    await this.paymentRepo.create(
      new DebtLoanPayment(
        randomUUID(),
        settled.id,
        input.amount,
        input.currency,
        null,
        new Date(),
        // Settled now, so `paidAt` matches `createdAt`. They only diverge
        // when the user corrects the date afterwards.
        new Date(),
      ),
      manager,
    );

    // LOAN settle = collect = credit (positive delta) — same convention as
    // SettleDebtLoanUseCase's real-payment branch.
    await this.poolService.applyDelta(input.userId, input.currency, input.amount, manager);

    return settled;
  }
}
