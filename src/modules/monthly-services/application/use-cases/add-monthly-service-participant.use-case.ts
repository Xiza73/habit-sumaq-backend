import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
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
      const currentParticipants = await this.participantRepo.findByServiceId(monthlyServiceId);
      const currentSum = currentParticipants.reduce((sum, p) => sum + p.defaultAmount, 0);
      if (currentSum + dto.defaultAmount > service.estimatedAmount) {
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

    return this.participantRepo.save(participant);
  }
}
