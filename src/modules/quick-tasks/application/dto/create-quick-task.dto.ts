import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateQuickTaskDto {
  @ApiProperty({
    description: 'Título corto de la tarea',
    example: 'Comprar leche',
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({
    description: 'Descripción en Markdown (opcional)',
    example: 'Ir al **mercado** de la esquina.',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
