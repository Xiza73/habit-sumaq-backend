import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { DebtLoan } from '../../domain/debt-loan.entity';
import { DebtLoanRepository } from '../../domain/debt-loan.repository';
import { DebtLoanStatus } from '../../domain/enums/debt-loan-status.enum';

import type { CreateDebtLoanDto } from '../dto/create-debt-loan.dto';

/**
 * Crea una deuda o préstamo nuevo. NEUTRAL en el pool — crear no mueve
 * dinero. El pool solo se mueve cuando se settle en real-payment mode.
 *
 * Regla A3-B (locked en Q1): `reference` es obligatoria. El DTO la valida
 * con `@IsNotEmpty` y `@Length(1, 255)`, pero también la chequeamos acá
 * defensivamente — los handlers podrían bypassear el pipe en escenarios
 * legacy y queremos que el use case sea seguro por sí mismo.
 */
@Injectable()
export class CreateDebtLoanUseCase {
  constructor(
    private readonly repo: DebtLoanRepository,
    @InjectPinoLogger(CreateDebtLoanUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(userId: string, dto: CreateDebtLoanDto): Promise<DebtLoan> {
    const reference = dto.reference?.trim();
    if (!reference) {
      throw new DomainException(
        'DEBT_LOAN_REFERENCE_REQUIRED',
        'DEBT/LOAN requiere el campo `reference`',
      );
    }

    const now = new Date();
    const debt = new DebtLoan(
      randomUUID(),
      userId,
      dto.type,
      dto.categoryId ?? null,
      dto.currency,
      dto.amount,
      dto.amount, // remainingAmount = amount on create
      DebtLoanStatus.PENDING,
      reference,
      dto.description ?? null,
      dto.date ? new Date(dto.date) : now,
      now,
      now,
      null,
    );

    const saved = await this.repo.save(debt);

    this.logger.info(
      {
        event: 'debt_loan.created',
        debtLoanId: saved.id,
        userId,
        type: saved.type,
        currency: saved.currency,
        amount: saved.amount,
      },
      'debt_loan.created',
    );

    return saved;
  }
}
