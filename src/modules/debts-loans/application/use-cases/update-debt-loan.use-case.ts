import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { DebtLoan } from '../../domain/debt-loan.entity';
import { DebtLoanRepository } from '../../domain/debt-loan.repository';
import { DebtLoanStatus } from '../../domain/enums/debt-loan-status.enum';

import type { UpdateDebtLoanDto } from '../dto/update-debt-loan.dto';

/**
 * PATCH /debts/:id. Reglas:
 *
 *  - El row debe existir y pertenecer al user (DBT_001 / DBT_002).
 *  - Si el row está `SETTLED`, SOLO se puede editar `amount`. Cualquier
 *    otro campo presente rejecta con `CANNOT_UPDATE_SETTLED_DEBT_LOAN`.
 *  - El nuevo `amount` no puede ser menor a lo ya liquidado
 *    (`oldAmount - oldRemainingAmount`).
 *  - Si subir `amount` reabre la obligación (porque `alreadySettled <
 *    newAmount`), el use case recalcula `remainingAmount` y flippea
 *    `status` de vuelta a PENDING.
 *  - `reference` vacío (solo whitespace) → reject `DEBT_LOAN_REFERENCE_REQUIRED`.
 *  - El pool NO se toca por updates — solo settle/revert lo modifica.
 */
@Injectable()
export class UpdateDebtLoanUseCase {
  constructor(private readonly repo: DebtLoanRepository) {}

  async execute(id: string, userId: string, dto: UpdateDebtLoanDto): Promise<DebtLoan> {
    const debt = await this.repo.findById(id);
    if (!debt || debt.isDeleted()) {
      throw new DomainException('DEBT_LOAN_NOT_FOUND', 'Deuda/préstamo no encontrado');
    }
    if (debt.userId !== userId) {
      throw new DomainException(
        'DEBT_LOAN_BELONGS_TO_OTHER_USER',
        'No tenés acceso a esta deuda/préstamo',
      );
    }

    if (debt.isSettled()) {
      const onlyAmountChanged =
        dto.amount !== undefined &&
        dto.description === undefined &&
        dto.date === undefined &&
        dto.categoryId === undefined &&
        dto.reference === undefined;
      if (!onlyAmountChanged) {
        throw new DomainException(
          'CANNOT_UPDATE_SETTLED_DEBT_LOAN',
          'Solo se puede modificar el monto de una deuda/préstamo liquidada',
        );
      }
    }

    // Snapshot pre-update for the amount/remaining math.
    const alreadySettled = debt.amount - debt.remainingAmount;

    if (dto.amount !== undefined && dto.amount < alreadySettled) {
      throw new DomainException(
        'DEBT_LOAN_AMOUNT_BELOW_SETTLED',
        'El nuevo monto es menor que el ya liquidado',
      );
    }

    if (dto.reference !== undefined && dto.reference.trim() === '') {
      throw new DomainException(
        'DEBT_LOAN_REFERENCE_REQUIRED',
        '`reference` no puede quedar vacía',
      );
    }

    debt.update({
      amount: dto.amount,
      description: dto.description,
      date: dto.date ? new Date(dto.date) : undefined,
      categoryId: dto.categoryId,
      reference: dto.reference?.trim(),
    });

    // If `amount` changed, recompute remainingAmount = newAmount -
    // alreadySettled. If that's > 0 AND the row was SETTLED, the
    // obligation reopens (status → PENDING).
    if (dto.amount !== undefined) {
      debt.remainingAmount = round2(debt.amount - alreadySettled);
      if (debt.remainingAmount > 0) {
        debt.status = DebtLoanStatus.PENDING;
      }
    }

    return this.repo.save(debt);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
