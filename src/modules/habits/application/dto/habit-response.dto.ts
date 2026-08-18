import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { HabitFrequency } from '../../domain/enums/habit-frequency.enum';
import { Habit } from '../../domain/habit.entity';

import { HabitLogResponseDto } from './habit-log-response.dto';

import type { HabitLog } from '../../domain/habit-log.entity';

export class HabitResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'user-uuid' })
  userId: string;

  @ApiProperty({ example: 'Tomar 8 vasos de agua' })
  name: string;

  @ApiPropertyOptional({ example: 'Beber al menos 8 vasos de agua al día', nullable: true })
  description: string | null;

  @ApiProperty({ enum: HabitFrequency, example: HabitFrequency.DAILY })
  frequency: HabitFrequency;

  @ApiProperty({ example: 8 })
  targetCount: number;

  @ApiPropertyOptional({ example: '#2196F3', nullable: true })
  color: string | null;

  @ApiPropertyOptional({ example: 'water', nullable: true })
  icon: string | null;

  @ApiProperty({ example: false })
  isArchived: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ example: 5, description: 'Racha actual de períodos consecutivos' })
  currentStreak?: number;

  @ApiPropertyOptional({ example: 15, description: 'Racha más larga histórica' })
  longestStreak?: number;

  @ApiPropertyOptional({ example: 0.8, description: 'Tasa de cumplimiento (últimos 30 días)' })
  completionRate?: number;

  @ApiPropertyOptional({ description: 'Log de hoy (si existe)', nullable: true })
  todayLog?: HabitLogResponseDto | null;

  @ApiPropertyOptional({
    example: 5,
    description: 'Conteo acumulado en el período actual (día para DAILY, semana para WEEKLY)',
  })
  periodCount?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Si la meta del período actual ya se cumplió',
  })
  periodCompleted?: boolean;

  @ApiPropertyOptional({
    example: 4,
    description:
      'Meta contra la que se mide el período actual — el DENOMINADOR a mostrar. ' +
      'En DAILY es el objetivo propio de ese día (`todayLog.targetCount`), que ' +
      'puede diferir del `targetCount` del hábito si ese día pidió más o menos. ' +
      'En WEEKLY es siempre el del hábito, porque la meta es de la semana. ' +
      'Usá SIEMPRE este campo para renderizar `periodCount / X`: leer ' +
      '`targetCount` del hábito reescribe los días pasados.',
  })
  periodTarget?: number;

  static fromDomain(habit: Habit): HabitResponseDto {
    const dto = new HabitResponseDto();
    dto.id = habit.id;
    dto.userId = habit.userId;
    dto.name = habit.name;
    dto.description = habit.description;
    dto.frequency = habit.frequency;
    dto.targetCount = habit.targetCount;
    dto.color = habit.color;
    dto.icon = habit.icon;
    dto.isArchived = habit.isArchived;
    dto.createdAt = habit.createdAt;
    dto.updatedAt = habit.updatedAt;
    return dto;
  }

  static fromDomainWithStats(
    habit: Habit,
    currentStreak: number,
    longestStreak: number,
    completionRate: number,
    todayLog: HabitLog | null,
    periodCount: number,
    periodCompleted: boolean,
    periodTarget: number,
  ): HabitResponseDto {
    const dto = HabitResponseDto.fromDomain(habit);
    dto.currentStreak = currentStreak;
    dto.longestStreak = longestStreak;
    dto.completionRate = completionRate;
    dto.todayLog = todayLog ? HabitLogResponseDto.fromDomain(todayLog) : null;
    dto.periodCount = periodCount;
    dto.periodCompleted = periodCompleted;
    dto.periodTarget = periodTarget;
    return dto;
  }
}
