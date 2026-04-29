import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IntervalUnit } from '../../domain/enums/interval-unit.enum';

import type { Chore } from '../../domain/chore.entity';

export class ChoreResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ example: 'Lavar sábanas' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Limpieza' })
  category: string | null;

  @ApiProperty({ example: 2 })
  intervalValue: number;

  @ApiProperty({ enum: IntervalUnit, example: IntervalUnit.WEEKS })
  intervalUnit: IntervalUnit;

  @ApiProperty({ example: '2026-04-15', description: 'Fecha de inicio (YYYY-MM-DD)' })
  startDate: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-04-15',
    description: 'Fecha en que se hizo por última vez (YYYY-MM-DD), null si nunca',
  })
  lastDoneDate: string | null;

  @ApiProperty({ example: '2026-04-29', description: 'Próximo vencimiento (YYYY-MM-DD)' })
  nextDueDate: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({
    example: false,
    description: 'True si nextDueDate es anterior al día actual en la timezone del cliente',
  })
  isOverdue: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  /**
   * Builds the response DTO. `currentDate` is the user's "today" as a
   * `YYYY-MM-DD` string, computed by the controller via `todayInTimezone()`.
   * Keeping it as a parameter (instead of recomputing) keeps the DTO pure
   * and lets tests pin the date deterministically.
   */
  static fromDomain(entity: Chore, currentDate: string): ChoreResponseDto {
    const dto = new ChoreResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.name = entity.name;
    dto.notes = entity.notes;
    dto.category = entity.category;
    dto.intervalValue = entity.intervalValue;
    dto.intervalUnit = entity.intervalUnit;
    dto.startDate = entity.startDate;
    dto.lastDoneDate = entity.lastDoneDate;
    dto.nextDueDate = entity.nextDueDate;
    dto.isActive = entity.isActive;
    dto.isOverdue = entity.isOverdueFor(currentDate);
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
