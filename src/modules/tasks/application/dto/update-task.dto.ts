import { ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { TaskStatus } from '../../domain/enums/task-status.enum';

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
    enum: TaskStatus,
    description:
      'Nuevo estado. Entrar a DONE sella `completedAt`; salir de DONE lo limpia, incluso ' +
      'volviendo a IN_REVIEW — así una tarea sacada de done deja de ser barrible.',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    description:
      'Cambia la sección de la task (cross-section move). La nueva sección debe pertenecer al usuario. ' +
      'Cuando se setea, `position` se reasigna al final de la nueva sección automáticamente.',
  })
  @IsOptional()
  @IsUUID()
  sectionId?: string;
}
