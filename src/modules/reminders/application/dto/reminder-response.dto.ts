import { ApiProperty } from '@nestjs/swagger';

import type { Reminder } from '../../domain/reminder.entity';

export class ReminderResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Llamar al dentista' })
  title: string;

  @ApiProperty({ example: 'Preguntar por el **presupuesto**', nullable: true })
  notes: string | null;

  @ApiProperty({
    example: '2026-05-20',
    nullable: true,
    description: 'YYYY-MM-DD. Null = nota sin fecha, nunca dispara alerta.',
  })
  remindDate: string | null;

  @ApiProperty({
    example: '15:00',
    nullable: true,
    description: 'HH:mm. Siempre null cuando `remindDate` es null.',
  })
  remindTime: string | null;

  @ApiProperty({ example: false })
  completed: boolean;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  completedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  static fromDomain(reminder: Reminder): ReminderResponseDto {
    const dto = new ReminderResponseDto();
    dto.id = reminder.id;
    dto.title = reminder.title;
    dto.notes = reminder.notes;
    dto.remindDate = reminder.remindDate;
    dto.remindTime = reminder.remindTime;
    dto.completed = reminder.completed;
    dto.completedAt = reminder.completedAt;
    dto.createdAt = reminder.createdAt;
    dto.updatedAt = reminder.updatedAt;
    return dto;
  }
}
