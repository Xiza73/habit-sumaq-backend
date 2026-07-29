import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

/**
 * Removes (soft-deletes) a participant from a shared service's config.
 * Removing the last remaining participant is allowed — the service simply
 * has zero active participants afterward (no "shared" flag to flip off;
 * "shared" is derived from `participants.length > 0`).
 */
@Injectable()
export class RemoveMonthlyServiceParticipantUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly participantRepo: MonthlyServiceParticipantRepository,
  ) {}

  async execute(monthlyServiceId: string, participantId: string, userId: string): Promise<void> {
    const service = await this.serviceRepo.findById(monthlyServiceId);
    if (!service || service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }

    const participants = await this.participantRepo.findByServiceId(monthlyServiceId);
    const participant = participants.find((p) => p.id === participantId);
    if (!participant) {
      throw new DomainException('MSP_PARTICIPANT_NOT_FOUND', 'Participante no encontrado');
    }

    await this.participantRepo.softDelete(participant.id);
  }
}
