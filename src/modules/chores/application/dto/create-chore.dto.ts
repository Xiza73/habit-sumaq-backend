import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { IntervalUnit } from '../../domain/enums/interval-unit.enum';

export class CreateChoreDto {
  @ApiProperty({ example: 'Lavar sábanas', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Notas libres sobre cómo hacer la tarea, productos, etc.',
    example: 'Usar detergente para colores claros, programa 60°C',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Categoría libre para agrupar (ej. "Limpieza", "Auto", "Mascotas")',
    example: 'Limpieza',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiProperty({
    description: 'Cantidad de unidades del intervalo. Debe ser entero positivo.',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  intervalValue: number;

  @ApiProperty({
    description: 'Unidad del intervalo (días/semanas/meses/años).',
    enum: IntervalUnit,
    example: IntervalUnit.WEEKS,
  })
  @IsEnum(IntervalUnit)
  intervalUnit: IntervalUnit;

  @ApiProperty({
    description: 'Fecha desde la que se empieza a contar el intervalo (YYYY-MM-DD).',
    example: '2026-04-15',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate debe tener formato YYYY-MM-DD' })
  startDate: string;
}
