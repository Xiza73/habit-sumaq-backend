import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { Budget } from '../../domain/budget.entity';
import { BudgetRepository } from '../../domain/budget.repository';
import { currentMonthInTimezone } from '../../infrastructure/timezone/current-month-in-timezone';

import type { CreateBudgetDto } from '../dto/create-budget.dto';

/**
 * Creates a budget for a (year, month, currency) tuple. If year/month are
 * omitted, the current month in the client timezone is used — this is the
 * common "create a budget for THIS month" path. Conflicts on the unique
 * `(userId, year, month, currency)` are surfaced as `BUDGET_ALREADY_EXISTS`
 * so the frontend can offer "edit existing instead" instead of just failing.
 */
@Injectable()
export class CreateBudgetUseCase {
  constructor(private readonly repo: BudgetRepository) {}

  async execute(userId: string, dto: CreateBudgetDto, timezone: string): Promise<Budget> {
    const period = currentMonthInTimezone(timezone);
    const year = dto.year ?? period.year;
    const month = dto.month ?? period.month;

    const existing = await this.repo.findByPeriodAndCurrency(userId, year, month, dto.currency);
    if (existing) {
      throw new DomainException(
        'BUDGET_ALREADY_EXISTS',
        'Ya tienes un budget para ese mes y moneda. Editá el existente o eliminálo primero.',
      );
    }

    const now = new Date();
    const budget = new Budget(
      randomUUID(),
      userId,
      year,
      month,
      dto.currency,
      dto.amount,
      now,
      now,
      null,
    );

    return this.repo.save(budget);
  }
}
