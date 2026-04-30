import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Llamar al banco', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    description: 'Descripción opcional. `null` la limpia.',
    nullable: true,
    maxLength: 5000,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Toggle de completado. `true` setea `completedAt = now()`, `false` lo limpia.',
  })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({
    description:
      'Cambia la sección de la task (cross-section move). La nueva sección debe pertenecer al usuario. ' +
      'Cuando se setea, `position` se reasigna al final de la nueva sección automáticamente.',
  })
  @IsOptional()
  @IsUUID()
  sectionId?: string;
}
