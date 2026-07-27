import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';

import type { UpdateMonthlyServiceParticipantDto } from '../dto/update-monthly-service-participant.dto';

/**
 * Edits a participant's `defaultAmount`. Re-validates the service-wide sum
 * cap against `estimatedAmount` — the participant being edited is excluded
 * from the "current sum" before adding back its NEW amount, so raising one
 * participant's share doesn't double-count its own old value.
 */
@Injectable()
export class UpdateMonthlyServiceParticipantUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly participantRepo: MonthlyServiceParticipantRepository,
  ) {}

  async execute(
    monthlyServiceId: string,
    participantId: string,
    userId: string,
    dto: UpdateMonthlyServiceParticipantDto,
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

    const participants = await this.participantRepo.findByServiceId(monthlyServiceId);
    const participant = participants.find((p) => p.id === participantId);
    if (!participant) {
      throw new DomainException('MSP_PARTICIPANT_NOT_FOUND', 'Participante no encontrado');
    }

    if (service.estimatedAmount !== null) {
      const sumOfOthers = participants
        .filter((p) => p.id !== participantId)
        .reduce((sum, p) => sum + p.defaultAmount, 0);
      if (sumOfOthers + dto.defaultAmount > service.estimatedAmount) {
        throw new DomainException(
          'MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED',
          'La suma de montos supera el estimado del servicio',
        );
      }
    }

    participant.updateDefaultAmount(dto.defaultAmount);
    return this.participantRepo.save(participant);
  }
}
