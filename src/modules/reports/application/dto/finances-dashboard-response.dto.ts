import { ApiProperty } from '@nestjs/swagger';

import { type Period } from '../utils/period-range';

export class DateRangeDto {
  @ApiProperty({ example: '2026-04-01T05:00:00.000Z', type: String, format: 'date-time' })
  from: string;

  @ApiProperty({ example: '2026-04-20T15:00:00.000Z', type: String, format: 'date-time' })
  to: string;
}

export class BalanceByCurrencyDto {
  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({ example: 1520.5 })
  amount: number;

  @ApiProperty({ example: 3 })
  accountCount: number;
}

export class FlowByCurrencyDto {
  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({ example: 3000 })
  income: number;

  @ApiProperty({ example: 2400 })
  expense: number;

  @ApiProperty({ example: 600, description: 'income - expense' })
  net: number;
}

export class TopExpenseCategoryDto {
  @ApiProperty({ example: '550e8400-…', nullable: true })
  categoryId: string | null;

  @ApiProperty({ example: 'Comida', nullable: true })
  name: string | null;

  @ApiProperty({ example: '#FF5722', nullable: true })
  color: string | null;

  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({ example: 420.75 })
  total: number;

  @ApiProperty({ example: 28.5, description: '% del total de EXPENSE en esa moneda (0-100)' })
  percentage: number;
}

export class DailyFlowPointDto {
  @ApiProperty({ example: '2026-04-15' })
  date: string;

  @ApiProperty({ example: 120 })
  income: number;

  @ApiProperty({ example: 85 })
  expense: number;
}

export class DailyFlowSeriesDto {
  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({ type: [DailyFlowPointDto] })
  points: DailyFlowPointDto[];
}

export class DebtsKpiDto {
  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({ example: 300, description: 'Sum of pending LOAN remaining amounts.' })
  owesYou: number;

  @ApiProperty({ example: 120, description: 'Sum of pending DEBT remaining amounts.' })
  youOwe: number;

  @ApiProperty({ example: 180, description: 'owesYou - youOwe. Positive = net creditor.' })
  net: number;
}

export class FinancesDashboardResponseDto {
  @ApiProperty({ enum: ['week', '30d', 'month', '3m'] })
  period: Period;

  @ApiProperty({ type: DateRangeDto })
  range: DateRangeDto;

  @ApiProperty({ type: [BalanceByCurrencyDto] })
  totalBalance: BalanceByCurrencyDto[];

  @ApiProperty({ type: [FlowByCurrencyDto] })
  periodFlow: FlowByCurrencyDto[];

  @ApiProperty({ type: [TopExpenseCategoryDto] })
  topExpenseCategories: TopExpenseCategoryDto[];

  @ApiProperty({ type: [DailyFlowSeriesDto] })
  dailyFlow: DailyFlowSeriesDto[];

  @ApiProperty({ type: [DebtsKpiDto] })
  pendingDebts: DebtsKpiDto[];
}
