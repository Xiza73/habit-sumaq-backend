import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsOptional } from 'class-validator';

import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { DateFormat } from '../../domain/enums/date-format.enum';
import { Language } from '../../domain/enums/language.enum';
import { StartOfWeek } from '../../domain/enums/start-of-week.enum';
import { Theme } from '../../domain/enums/theme.enum';

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({
    enum: Language,
    description: 'Idioma de la interfaz',
    example: Language.ES,
  })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiPropertyOptional({
    enum: Theme,
    description: 'Tema visual: claro, oscuro o automático del sistema',
    example: Theme.DARK,
  })
  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @ApiPropertyOptional({
    enum: Currency,
    description: 'Moneda por defecto para nuevas cuentas',
    example: Currency.PEN,
  })
  @IsOptional()
  @IsEnum(Currency)
  defaultCurrency?: Currency;

  @ApiPropertyOptional({
    enum: DateFormat,
    description: 'Formato de fecha preferido',
    example: DateFormat.DD_MM_YYYY,
  })
  @IsOptional()
  @IsEnum(DateFormat)
  dateFormat?: DateFormat;

  @ApiPropertyOptional({
    enum: StartOfWeek,
    description: 'Primer día de la semana',
    example: StartOfWeek.MONDAY,
  })
  @IsOptional()
  @IsEnum(StartOfWeek)
  startOfWeek?: StartOfWeek;
}
