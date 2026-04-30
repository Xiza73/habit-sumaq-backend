import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';
import { AccountRepository } from '@modules/accounts/domain/account.repository';
import { CategoryRepository } from '@modules/categories/domain/category.repository';
import { TransactionType } from '@modules/transactions/domain/enums/transaction-type.enum';
import { Transaction } from '@modules/transactions/domain/transaction.entity';
import { TransactionRepository } from '@modules/transactions/domain/transaction.repository';

import { Budget } from '../../domain/budget.entity';
import { BudgetRepository } from '../../domain/budget.repository';

import type { AddBudgetMovementDto } from '../dto/add-budget-movement.dto';

/**
 * Adds a movement to a budget — creates an EXPENSE transaction tagged with
 * `budgetId` and debits the chosen account.
 *
 * Validations (in order):
 *  1. Budget exists, belongs to the user, not soft-deleted.
 *  2. Account exists, belongs to the user.
 *  3. Account currency matches budget currency.
 *  4. Category exists and belongs to the user.
 *  5. Movement date falls inside the budget's calendar month.
 *
 * The two writes (account.save + transaction.save) are sequential — same
 * pattern as PayMonthlyServiceUseCase. If the account write succeeds and the
 * transaction write fails, the user retries and the second attempt creates
 * a fresh transaction; the account would be debited twice. Wrapping in a
 * DataSource transaction would fix that, but the project consistently chooses
 * sequential writes for readability — we follow that for now and revisit if
 * inconsistencies surface in practice.
 */
@Injectable()
export class AddBudgetMovementUseCase {
  constructor(
    private readonly budgetRepo: BudgetRepository,
    private readonly txRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
    private readonly categoryRepo: CategoryRepository,
    @InjectPinoLogger(AddBudgetMovementUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    budgetId: string,
    userId: string,
    dto: AddBudgetMovementDto,
  ): Promise<{ budget: Budget; transaction: Transaction }> {
    const budget = await this.budgetRepo.findById(budgetId);
    if (!budget || budget.userId !== userId || budget.isDeleted()) {
      throw new DomainException('BUDGET_NOT_FOUND', 'Budget no encontrado');
    }

    const account = await this.accountRepo.findById(dto.accountId);
    if (!account || account.userId !== userId) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta no encontrada');
    }
    if (String(account.currency) !== budget.currency) {
      throw new DomainException(
        'CURRENCY_MISMATCH',
        'La moneda de la cuenta debe coincidir con la del budget',
      );
    }

    const category = await this.categoryRepo.findById(dto.categoryId);
    if (!category || category.userId !== userId) {
      throw new DomainException('CATEGORY_NOT_FOUND', 'Categoría no encontrada');
    }

    if (!isDateInBudgetMonth(dto.date, budget.year, budget.month)) {
      throw new DomainException(
        'MOVEMENT_DATE_OUT_OF_RANGE',
        'La fecha del movimiento debe estar dentro del mes del budget',
      );
    }

    // Debit the account — budget movements always reduce balance (always
    // EXPENSE). No allowance for "income against budget".
    account.debit(dto.amount);
    await this.accountRepo.save(account);

    const now = new Date();
    const transaction = new Transaction(
      randomUUID(),
      userId,
      account.id,
      category.id,
      TransactionType.EXPENSE,
      dto.amount,
      dto.description ?? null,
      dto.date,
      null, // destinationAccountId
      null, // reference
      null, // status
      null, // relatedTransactionId
      null, // remainingAmount
      now,
      now,
      null, // deletedAt
      null, // monthlyServiceId
      budget.id,
    );

    const savedTx = await this.txRepo.save(transaction);

    this.logger.info(
      {
        event: 'budget.movement_added',
        budgetId: budget.id,
        userId,
        transactionId: savedTx.id,
        amount: dto.amount,
      },
      'budget.movement_added',
    );

    return { budget, transaction: savedTx };
  }
}

/**
 * Checks the date falls within `(year, month)` interpreted in UTC. Frontend is
 * expected to send the date as the canonical "noon UTC of YYYY-MM-DD" pattern
 * already used elsewhere (DST-safe), so the UTC check matches what the user
 * picked on the calendar.
 */
function isDateInBudgetMonth(date: Date, year: number, month: number): boolean {
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
}
