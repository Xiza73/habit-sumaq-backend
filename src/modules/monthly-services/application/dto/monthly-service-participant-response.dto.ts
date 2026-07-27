import { ApiProperty } from '@nestjs/swagger';

import type { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';

export class MonthlyServiceParticipantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  monthlyServiceId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ example: 'Ana' })
  reference: string;

  @ApiProperty({ example: 100.0 })
  defaultAmount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromDomain(entity: MonthlyServiceParticipant): MonthlyServiceParticipantResponseDto {
    const dto = new MonthlyServiceParticipantResponseDto();
    dto.id = entity.id;
    dto.monthlyServiceId = entity.monthlyServiceId;
    dto.userId = entity.userId;
    dto.reference = entity.reference;
    dto.defaultAmount = entity.defaultAmount;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
