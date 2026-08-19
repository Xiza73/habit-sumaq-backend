import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { HabitLog } from '../../domain/habit-log.entity';

export class HabitLogResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'habit-uuid' })
  habitId: string;

  @ApiProperty({ example: '2026-03-13' })
  date: string;

  @ApiProperty({ example: 5 })
  count: number;

  @ApiProperty({ example: false })
  completed: boolean;

  @ApiProperty({
    example: 3,
    description:
      'Objetivo que aplicaba a ESE día, congelado al escribir el log. Es el denominador ' +
      'de ese día: el heatmap colorea cada celda contra su propio targetCount, no contra ' +
      'el default actual del hábito. Sin este campo, subir el objetivo repinta el pasado.',
  })
  targetCount: number;

  @ApiPropertyOptional({ example: 'Hoy fue un buen día', nullable: true })
  note: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromDomain(log: HabitLog): HabitLogResponseDto {
    const dto = new HabitLogResponseDto();
    dto.id = log.id;
    dto.habitId = log.habitId;
    dto.date = log.date;
    dto.count = log.count;
    dto.completed = log.completed;
    dto.targetCount = log.targetCount;
    dto.note = log.note;
    dto.createdAt = log.createdAt;
    dto.updatedAt = log.updatedAt;
    return dto;
  }
}
