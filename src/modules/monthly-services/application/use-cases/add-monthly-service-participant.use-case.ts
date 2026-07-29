import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { toCents } from '@common/money/to-cents';
import { isUniqueViolation } from '@common/persistence/postgres-error';
import { normalizeReference } from '@common/text/normalize-reference';

import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

import type { CreateMonthlyServiceParticipantDto } from '../dto/create-monthly-service-participant.dto';

/**
 * Adds a participant to a shared monthly service's split config. Validates:
 *   - the service exists and is owned by the caller
 *   - `defaultAmount > 0`
 *   - no other active participant shares the same normalized reference
 *   - `sum(defaultAmount)` across all active participants (including the
 *     new one) does not exceed `service.estimatedAmount` when it's set
 *
 * Slice 1: config only — does not touch `debts_loans` or mark the service
 * as "shared" via a dedicated flag (shared = "has 1+ active participants").
 */
@Injectable()
export class AddMonthlyServiceParticipantUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly participantRepo: MonthlyServiceParticipantRepository,
  ) {}

  async execute(
    monthlyServiceId: string,
    userId: string,
    dto: CreateMonthlyServiceParticipantDto,
  ): Promise<MonthlyServiceParticipant> {
    const service = await this.serviceRepo.findById(monthlyServiceId);
    if (!service || service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }

    if (dto.defaultAmount <= 0) {
      throw new DomainException(
        'MSP_PARTICIPANT_AMOUNT_NOT_POSITIVE',
        'El monto por defecto debe ser mayor a 0',
      );
    }

    const normalizedReference = normalizeReference(dto.reference);

    const existing = await this.participantRepo.findByNormalizedReference(
      monthlyServiceId,
      normalizedReference,
    );
    if (existing) {
      throw new DomainException(
        'MSP_PARTICIPANT_DUPLICATE_REFERENCE',
        'Ya existe un participante con esa referencia',
      );
    }

    if (service.estimatedAmount !== null) {
      // NOTE: This read-validate-write sum check is NOT transactionally locked.
      // Two concurrent edits to the same service can both read a stale total and
      // each pass the cap, letting the combined sum exceed `estimatedAmount`
      // (TOCTOU). Accepted for now — participant config is single-user editing;
      // revisit with row locking or a DB-level constraint if it becomes a problem.
      const currentParticipants = await this.participantRepo.findByServiceId(monthlyServiceId);
      // Compare in integer cents: NUMERIC(14,2) values are exact, but JS float
      // addition drifts (e.g. 0.1 + 0.2 = 0.30000000000000004), which would
      // falsely reject an exactly-equal sum. `≤` semantics preserved (equal is ok).
      const currentSumCents = currentParticipants.reduce(
        (sum, p) => sum + toCents(p.defaultAmount),
        0,
      );
      const newSumCents = currentSumCents + toCents(dto.defaultAmount);
      if (newSumCents > toCents(service.estimatedAmount)) {
        throw new DomainException(
          'MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED',
          'La suma de montos supera el estimado del servicio',
        );
      }
    }

    const now = new Date();
    const participant = new MonthlyServiceParticipant({
      id: randomUUID(),
      monthlyServiceId,
      userId,
      reference: dto.reference,
      normalizedReference,
      defaultAmount: dto.defaultAmount,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    try {
      return await this.participantRepo.save(participant);
    } catch (error) {
      // Defense-in-depth for the reference pre-check TOCTOU: under concurrency
      // two inserts can race, the second hitting the partial unique index
      // `UQ_msp_service_normalized_reference_active` (SQLSTATE 23505). Translate
      // it into the same 409 the pre-check raises instead of surfacing a 500.
      if (isUniqueViolation(error)) {
        throw new DomainException(
          'MSP_PARTICIPANT_DUPLICATE_REFERENCE',
          'Ya existe un participante con esa referencia',
        );
      }
      throw error;
    }
  }
}
