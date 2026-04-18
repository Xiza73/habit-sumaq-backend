import { ApiProperty } from '@nestjs/swagger';

import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { DateFormat } from '../../domain/enums/date-format.enum';
import { Language } from '../../domain/enums/language.enum';
import { StartOfWeek } from '../../domain/enums/start-of-week.enum';
import { Theme } from '../../domain/enums/theme.enum';

import type { UserSettings } from '../../domain/user-settings.entity';

export class UserSettingsResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID de la configuración',
  })
  id: string;

  @ApiProperty({
    enum: Language,
    example: Language.ES,
    description: 'Idioma de la interfaz',
  })
  language: Language;

  @ApiProperty({
    enum: Theme,
    example: Theme.SYSTEM,
    description: 'Tema visual',
  })
  theme: Theme;

  @ApiProperty({
    enum: Currency,
    example: Currency.PEN,
    description: 'Moneda por defecto para nuevas cuentas',
  })
  defaultCurrency: Currency;

  @ApiProperty({
    enum: DateFormat,
    example: DateFormat.DD_MM_YYYY,
    description: 'Formato de fecha preferido',
  })
  dateFormat: DateFormat;

  @ApiProperty({
    enum: StartOfWeek,
    example: StartOfWeek.MONDAY,
    description: 'Primer día de la semana',
  })
  startOfWeek: StartOfWeek;

  @ApiProperty({
    example: 'America/Lima',
    description: 'Zona horaria IANA del usuario (default "UTC" hasta que el cliente la fije)',
  })
  timezone: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromDomain(settings: UserSettings): UserSettingsResponseDto {
    const dto = new UserSettingsResponseDto();
    dto.id = settings.id;
    dto.language = settings.language;
    dto.theme = settings.theme;
    dto.defaultCurrency = settings.defaultCurrency;
    dto.dateFormat = settings.dateFormat;
    dto.startOfWeek = settings.startOfWeek;
    dto.timezone = settings.timezone;
    dto.createdAt = settings.createdAt;
    dto.updatedAt = settings.updatedAt;
    return dto;
  }
}
