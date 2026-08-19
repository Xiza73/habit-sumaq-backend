import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { DATE_REGEX, TIME_REGEX } from './create-reminder.dto';

export class UpdateReminderDto {
  @ApiPropertyOptional({ example: 'Llamar al dentista', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({
    description: 'Mandar `null` borra la fecha — y con ella la hora, que sin fecha no existe.',
    example: '2026-05-20',
    nullable: true,
  })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'remindDate debe tener formato YYYY-MM-DD' })
  remindDate?: string | null;

  @ApiPropertyOptional({ example: '15:00', nullable: true })
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'remindTime debe tener formato HH:mm' })
  remindTime?: string | null;

  @ApiPropertyOptional({ description: 'Marcar como hecho o reabrir.', example: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
