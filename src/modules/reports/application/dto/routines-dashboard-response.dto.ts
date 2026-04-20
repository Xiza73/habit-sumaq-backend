import { ApiProperty } from '@nestjs/swagger';

import { type Period } from '../utils/period-range';

import { DateRangeDto } from './finances-dashboard-response.dto';

export class HabitStreakDto {
  @ApiProperty({ example: '550e8400-…' })
  habitId: string;

  @ApiProperty({ example: 'Tomar agua' })
  name: string;

  @ApiProperty({ example: '#2196F3', nullable: true })
  color: string | null;

  @ApiProperty({ enum: ['DAILY', 'WEEKLY'] })
  frequency: 'DAILY' | 'WEEKLY';

  @ApiProperty({ example: 5 })
  currentStreak: number;

  @ApiProperty({ example: 12 })
  longestStreak: number;

  @ApiProperty({ example: 0.83, description: 'Completion rate within the stats window (0-1).' })
  completionRate: number;
}

export class HabitCompletionDto {
  @ApiProperty({ example: 18 })
  completedToday: number;

  @ApiProperty({ example: 21 })
  dueToday: number;

  @ApiProperty({
    example: 0.86,
    description: 'completedToday / dueToday, or 0 if no habits are due today. Range 0-1.',
  })
  rate: number;
}

export class QuickTasksTodayDto {
  @ApiProperty({ example: 3 })
  completed: number;

  @ApiProperty({ example: 2 })
  pending: number;

  @ApiProperty({ example: 5, description: 'completed + pending' })
  total: number;
}

export class RoutinesDashboardResponseDto {
  @ApiProperty({ enum: ['week', '30d', 'month', '3m'] })
  period: Period;

  @ApiProperty({ type: DateRangeDto })
  range: DateRangeDto;

  @ApiProperty({
    type: [HabitStreakDto],
    description: 'Top habit streaks (active ones), ordered by currentStreak DESC.',
  })
  topHabitStreaks: HabitStreakDto[];

  @ApiProperty({ type: HabitCompletionDto })
  habitCompletionToday: HabitCompletionDto;

  @ApiProperty({ type: QuickTasksTodayDto })
  quickTasksToday: QuickTasksTodayDto;
}
