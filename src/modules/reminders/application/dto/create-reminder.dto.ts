import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** `YYYY-MM-DD`. */
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** `HH:mm`, 24h. */
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateReminderDto {
  @ApiProperty({
    description: 'Qué hay que recordar',
    example: 'Llamar al dentista',
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({
    description: 'Detalle en Markdown (opcional)',
    example: 'Preguntar por el **presupuesto** de la limpieza.',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({
    description:
      'Día en que toca (YYYY-MM-DD, en la zona del usuario). Sin fecha, el recordatorio ' +
      'es solo una nota: se lista pero nunca dispara alerta.',
    example: '2026-05-20',
    nullable: true,
  })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'remindDate debe tener formato YYYY-MM-DD' })
  remindDate?: string | null;

  @ApiPropertyOptional({
    description:
      'Hora en que toca (HH:mm, 24h). Solo válida junto a `remindDate` — una hora sola no ' +
      'dice nada sobre cuándo pasa algo que pasa una vez, así que el dominio la rechaza.',
    example: '15:00',
    nullable: true,
  })
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'remindTime debe tener formato HH:mm' })
  remindTime?: string | null;
}
