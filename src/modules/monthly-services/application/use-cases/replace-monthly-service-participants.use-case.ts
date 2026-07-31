import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { DataSource, type EntityManager } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { toCents } from '@common/money/to-cents';
import { isUniqueViolation } from '@common/persistence/postgres-error';
import { normalizeReference } from '@common/text/normalize-reference';

import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

import type { ReplaceMonthlyServiceParticipantsDto } from '../dto/replace-monthly-service-participants.dto';

/**
 * PUT /monthly-services/:id/participants — batch replace.
 *
 * The submitted `participants[]` IS the final active set. Diffs the
 * batch against the currently active participants by normalized
 * reference: matches get their `defaultAmount` (and raw `reference`)
 * updated in place (id/createdAt preserved), rows missing from the
 * batch are soft-deleted, and new normalized references are inserted.
 * Preferred over delete-all-reinsert so ids/createdAt stay stable —
 * participant ids aren't referenced elsewhere today, but diffing avoids
 * unnecessary table churn.
 *
 * Validates (before opening the transaction):
 *   - the service exists and is owned by the caller
 *   - references are unique by NORMALIZED reference WITHIN the batch
 *   - each `defaultAmount > 0`
 *   - `sum(defaultAmount) <= service.estimatedAmount` when set (integer
 *     cents comparison via `toCents`, same convention as the retired
 *     one-at-a-time use cases)
 *
 * All writes happen inside ONE `dataSource.transaction(manager)` —
 * either the whole batch lands or none of it does.
 */
@Injectable()
export class ReplaceMonthlyServiceParticipantsUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly participantRepo: MonthlyServiceParticipantRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(
    monthlyServiceId: string,
    userId: string,
    dto: ReplaceMonthlyServiceParticipantsDto,
  ): Promise<MonthlyServiceParticipant[]> {
    const service = await this.serviceRepo.findById(monthlyServiceId);
    if (!service || service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }

    const batch = dto.participants.map((item) => ({
      reference: item.reference,
      normalizedReference: normalizeReference(item.reference),
      defaultAmount: item.defaultAmount,
    }));

    for (const item of batch) {
      if (item.defaultAmount <= 0) {
        throw new DomainException(
          'MSP_PARTICIPANT_AMOUNT_NOT_POSITIVE',
          'El monto por defecto debe ser mayor a 0',
        );
      }
    }

    const seenNormalizedReferences = new Set<string>();
    for (const item of batch) {
      if (seenNormalizedReferences.has(item.normalizedReference)) {
        throw new DomainException(
          'MSP_PARTICIPANT_DUPLICATE_REFERENCE',
          'Hay referencias duplicadas dentro de la lista enviada',
        );
      }
      seenNormalizedReferences.add(item.normalizedReference);
    }

    if (service.estimatedAmount !== null) {
      // Compare in integer cents: NUMERIC(14,2) values are exact, but JS
      // float addition drifts (e.g. 0.1 + 0.2 = 0.30000000000000004), which
      // would falsely reject an exactly-equal sum. `<=` semantics preserved.
      const batchSumCents = batch.reduce((sum, item) => sum + toCents(item.defaultAmount), 0);
      if (batchSumCents > toCents(service.estimatedAmount)) {
        throw new DomainException(
          'MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED',
          'La suma de montos supera el estimado del servicio',
        );
      }
    }

    try {
      return await this.dataSource.transaction((manager) =>
        this.applyDiff(monthlyServiceId, userId, batch, manager),
      );
    } catch (error) {
      // Defense-in-depth: under concurrency two batch replaces (or a batch
      // replace racing a legacy insert) can both pass the in-batch dedupe
      // check yet collide on the partial unique index
      // `UQ_msp_participants_normalized_reference_active` (SQLSTATE 23505).
      // Translate it into the same 409 the pre-check raises.
      if (isUniqueViolation(error)) {
        throw new DomainException(
          'MSP_PARTICIPANT_DUPLICATE_REFERENCE',
          'Ya existe un participante con esa referencia',
        );
      }
      throw error;
    }
  }

  private async applyDiff(
    monthlyServiceId: string,
    userId: string,
    batch: Array<{ reference: string; normalizedReference: string; defaultAmount: number }>,
    manager: EntityManager,
  ): Promise<MonthlyServiceParticipant[]> {
    const current = await this.participantRepo.findByServiceId(monthlyServiceId);
    const currentByNormalizedReference = new Map(
      current.map((p) => [p.normalizedReference, p] as const),
    );
    const batchNormalizedReferences = new Set(batch.map((item) => item.normalizedReference));

    // Soft-delete active participants not present in the batch.
    for (const existing of current) {
      if (!batchNormalizedReferences.has(existing.normalizedReference)) {
        await this.participantRepo.softDelete(existing.id, manager);
      }
    }

    const result: MonthlyServiceParticipant[] = [];
    for (const item of batch) {
      const existing = currentByNormalizedReference.get(item.normalizedReference);
      const now = new Date();

      if (existing) {
        existing.reference = item.reference;
        existing.updateDefaultAmount(item.defaultAmount);
        result.push(await this.participantRepo.save(existing, manager));
      } else {
        const created = new MonthlyServiceParticipant({
          id: randomUUID(),
          monthlyServiceId,
          userId,
          reference: item.reference,
          normalizedReference: item.normalizedReference,
          defaultAmount: item.defaultAmount,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
        result.push(await this.participantRepo.save(created, manager));
      }
    }

    return result;
  }
}
