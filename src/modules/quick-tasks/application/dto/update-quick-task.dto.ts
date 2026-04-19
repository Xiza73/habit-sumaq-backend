import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateQuickTaskDto {
  @ApiPropertyOptional({ description: 'Nuevo título', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    description: 'Nueva descripción Markdown (envía null explícito para limpiar)',
    maxLength: 5000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Marca la tarea como completada / no completada' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
