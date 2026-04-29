import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { ChoreLog } from '../../domain/chore-log.entity';

export class ChoreLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  choreId: string;

  @ApiProperty({ example: '2026-04-15', description: 'Fecha en que se hizo (YYYY-MM-DD)' })
  doneAt: string;

  @ApiPropertyOptional({ nullable: true, example: 'Usé desinfectante nuevo' })
  note: string | null;

  @ApiProperty()
  createdAt: Date;

  static fromDomain(log: ChoreLog): ChoreLogResponseDto {
    const dto = new ChoreLogResponseDto();
    dto.id = log.id;
    dto.choreId = log.choreId;
    dto.doneAt = log.doneAt;
    dto.note = log.note;
    dto.createdAt = log.createdAt;
    return dto;
  }
}
