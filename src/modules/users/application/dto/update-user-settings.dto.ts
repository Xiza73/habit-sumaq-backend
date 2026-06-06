import { ApiPropertyOptional } from '@nestjs/swagger';

import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

import { Currency } from '@common/enums/currency.enum';
import { IsIanaTimezone } from '@common/validators/is-iana-timezone.validator';

import { DateFormat } from '../../domain/enums/date-format.enum';
import { Language } from '../../domain/enums/language.enum';
import { MonthlyServicesGroupBy } from '../../domain/enums/monthly-services-group-by.enum';
import { MonthlyServicesOrderBy } from '../../domain/enums/monthly-services-order-by.enum';
import { MonthlyServicesOrderDir } from '../../domain/enums/monthly-services-order-dir.enum';
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

  @ApiPropertyOptional({
    description:
      'Zona horaria IANA del usuario (usada para cálculos "por día", ej: cleanup de tareas diarias)',
    example: 'America/Lima',
  })
  @IsOptional()
  @IsIanaTimezone()
  timezone?: string;

  @ApiPropertyOptional({
    enum: MonthlyServicesGroupBy,
    description: 'Agrupación de la lista de servicios mensuales en el web',
    example: MonthlyServicesGroupBy.NONE,
  })
  @IsOptional()
  @IsEnum(MonthlyServicesGroupBy)
  monthlyServicesGroupBy?: MonthlyServicesGroupBy;

  @ApiPropertyOptional({
    enum: MonthlyServicesOrderBy,
    description: 'Campo por el que se ordena la lista de servicios mensuales',
    example: MonthlyServicesOrderBy.NAME,
  })
  @IsOptional()
  @IsEnum(MonthlyServicesOrderBy)
  monthlyServicesOrderBy?: MonthlyServicesOrderBy;

  @ApiPropertyOptional({
    enum: MonthlyServicesOrderDir,
    description: 'Dirección del orden (asc/desc)',
    example: MonthlyServicesOrderDir.ASC,
  })
  @IsOptional()
  @IsEnum(MonthlyServicesOrderDir)
  monthlyServicesOrderDir?: MonthlyServicesOrderDir;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Keys de navegación favoritas del usuario (max 4). Drives la bottom nav en mobile (4 slots + Settings fijo) y la marca ★ en la sidebar de desktop. Las keys son free-form strings — el set válido vive en el `NAV_REGISTRY` del frontend; backend no valida el contenido para desacoplar repos. Array vacío es válido (mobile queda con solo el slot de Settings).',
    example: ['accounts', 'transactions', 'habits', 'quick-tasks'],
    maxItems: 4,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsString({ each: true })
  favoriteKeys?: string[];
}
