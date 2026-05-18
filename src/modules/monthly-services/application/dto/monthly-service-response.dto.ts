import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { MonthlyService } from '../../domain/monthly-service.entity';

export class MonthlyServiceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ example: 'Netflix' })
  name: string;

  @ApiProperty()
  defaultAccountId: string;

  @ApiProperty()
  categoryId: string;

  @ApiProperty({ example: 'PEN' })
  currency: string;

  @ApiProperty({
    example: 1,
    description:
      'Cadencia de cobro en meses (1 mensual, 3 trimestral, 6 semestral, 12 anual). Inmutable.',
  })
  frequencyMonths: number;

  @ApiPropertyOptional({ example: 45.0, nullable: true })
  estimatedAmount: number | null;

  @ApiPropertyOptional({ example: 15, nullable: true })
  dueDay: number | null;

  @ApiProperty({ example: '2026-03', description: 'Primer período a pagar (YYYY-MM)' })
  startPeriod: string;

  @ApiPropertyOptional({
    example: '2026-03',
    description: 'Último período pagado (YYYY-MM) — null si nunca se pagó',
    nullable: true,
  })
  lastPaidPeriod: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({
    example: '2026-04',
    description:
      'Período a pagar siguiente (YYYY-MM). Si nunca se pagó = startPeriod, si no = lastPaidPeriod + 1 mes.',
  })
  nextDuePeriod: string;

  @ApiProperty({
    example: false,
    description: 'True si nextDuePeriod es anterior al mes actual en la timezone del cliente',
  })
  isOverdue: boolean;

  @ApiProperty({
    example: true,
    description:
      'True si nextDuePeriod es estrictamente futuro respecto al mes actual (ya se pagó este mes)',
  })
  isPaidForCurrentMonth: boolean;

  @ApiProperty({
    example: 35.0,
    description:
      'Suma de transacciones EXPENSE vinculadas a este servicio en el mes calendario actual ' +
      '(según la timezone del cliente). Driver del KPI "Pagado / Estimado" en el dashboard de ' +
      'servicios. Sólo se popula con valor exacto en GET /monthly-services (la list response); ' +
      'el resto de endpoints lo emiten como 0 (no es información que el cliente consulte fuera ' +
      'de la list view).',
  })
  paidAmountForCurrentMonth: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  /**
   * @param entity Domain entity.
   * @param currentPeriod 'YYYY-MM' in the user's timezone (used for the derived booleans).
   * @param paidAmountForCurrentMonth Sum of transactions linked to this service for `currentPeriod`.
   *   Pass `0` from endpoints that don't compute it (everything except the list view).
   */
  static fromDomain(
    entity: MonthlyService,
    currentPeriod: string,
    paidAmountForCurrentMonth: number,
  ): MonthlyServiceResponseDto {
    const dto = new MonthlyServiceResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.name = entity.name;
    dto.defaultAccountId = entity.defaultAccountId;
    dto.categoryId = entity.categoryId;
    dto.currency = entity.currency;
    dto.frequencyMonths = entity.frequencyMonths;
    dto.estimatedAmount = entity.estimatedAmount;
    dto.dueDay = entity.dueDay;
    dto.startPeriod = entity.startPeriod;
    dto.lastPaidPeriod = entity.lastPaidPeriod;
    dto.isActive = entity.isActive;
    dto.nextDuePeriod = entity.nextDuePeriod();
    dto.isOverdue = entity.isOverdueFor(currentPeriod);
    dto.isPaidForCurrentMonth = entity.isPaidForMonth(currentPeriod);
    dto.paidAmountForCurrentMonth = paidAmountForCurrentMonth;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
