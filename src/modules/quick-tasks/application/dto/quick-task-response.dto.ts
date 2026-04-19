import { ApiProperty } from '@nestjs/swagger';

import type { QuickTask } from '../../domain/quick-task.entity';

export class QuickTaskResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Comprar leche' })
  title: string;

  @ApiProperty({ example: 'Nota **opcional**', nullable: true })
  description: string | null;

  @ApiProperty({ example: false })
  completed: boolean;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  completedAt: Date | null;

  @ApiProperty({ example: 1 })
  position: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  static fromDomain(task: QuickTask): QuickTaskResponseDto {
    const dto = new QuickTaskResponseDto();
    dto.id = task.id;
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
