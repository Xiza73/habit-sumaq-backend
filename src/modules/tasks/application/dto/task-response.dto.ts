import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { Task } from '../../domain/task.entity';

export class TaskResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'UUID del usuario propietario' })
  userId: string;

  @ApiProperty({ description: 'UUID de la sección a la que pertenece' })
  sectionId: string;

  @ApiProperty({ example: 'Llamar al banco' })
  title: string;

  @ApiPropertyOptional({ description: 'Descripción opcional (markdown)', nullable: true })
  description: string | null;

  @ApiProperty({ example: false })
  completed: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp del marcado como completado. `null` cuando incompleta.',
    nullable: true,
  })
  completedAt: Date | null;

  @ApiProperty({ example: 1, description: 'Posición 1-indexed dentro de la sección' })
  position: number;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  updatedAt: Date;

  static fromDomain(task: Task): TaskResponseDto {
    const dto = new TaskResponseDto();
    dto.id = task.id;
    dto.userId = task.userId;
    dto.sectionId = task.sectionId;
    dto.title = task.title;
    dto.description = task.description;
    dto.completed = task.completed;
    dto.completedAt = task.completedAt;
    dto.position = task.position;
    dto.createdAt = task.createdAt;
    dto.updatedAt = task.updatedAt;
    return dto;
  }
}
