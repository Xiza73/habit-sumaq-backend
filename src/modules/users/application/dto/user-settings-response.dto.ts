import { ApiProperty } from '@nestjs/swagger';

import { Currency } from '@common/enums/currency.enum';

import { DateFormat } from '../../domain/enums/date-format.enum';
import { Language } from '../../domain/enums/language.enum';
import { MonthlyServicesGroupBy } from '../../domain/enums/monthly-services-group-by.enum';
import { MonthlyServicesOrderBy } from '../../domain/enums/monthly-services-order-by.enum';
import { MonthlyServicesOrderDir } from '../../domain/enums/monthly-services-order-dir.enum';
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

  @ApiProperty({
    enum: MonthlyServicesGroupBy,
    example: MonthlyServicesGroupBy.NONE,
    description: 'Agrupación preferida de la lista de servicios mensuales',
  })
  monthlyServicesGroupBy: MonthlyServicesGroupBy;

  @ApiProperty({
    enum: MonthlyServicesOrderBy,
    example: MonthlyServicesOrderBy.NAME,
    description: 'Campo de orden de la lista de servicios mensuales',
  })
  monthlyServicesOrderBy: MonthlyServicesOrderBy;

  @ApiProperty({
    enum: MonthlyServicesOrderDir,
    example: MonthlyServicesOrderDir.ASC,
    description: 'Dirección de orden (asc/desc)',
  })
  monthlyServicesOrderDir: MonthlyServicesOrderDir;

  @ApiProperty({
    type: [String],
    description:
      'Keys de navegación favoritas del usuario (max 4) que drives la bottom nav en mobile y la marca ★ en sidebar de desktop. El default de la columna debe coincidir con `DEFAULT_FAVORITES` del frontend — una key que nombre una ruta inexistente ocupa un slot sin renderizar nada.',
    example: ['debts', 'budgets', 'habits', 'quick-tasks'],
  })
  favoriteKeys: string[];

  @ApiProperty({
    type: [String],
    description:
      'Módulos que el usuario apagó en Settings. El frontend los oculta de la sidebar y la bottom nav, de su porción de los dashboards de reportes, y del popover de alertas. Array vacío (el default) = todos los módulos activos. Las keys son free-form: el set válido vive en el `NAV_REGISTRY` del frontend.',
    example: ['chores', 'reminders'],
  })
  disabledModules: string[];

  @ApiProperty({
    example: 1,
    description:
      'Escudos de racha en mano (0-2). Se gana uno por mes calendario al alcanzar 20 períodos ' +
      'de racha en algún hábito; uno ganado con el stock lleno SE PIERDE, no se acumula. ' +
      'Se gasta con `POST /habits/:id/rescue-streak`. El frontend habilita el botón de rescate ' +
      'cuando esto es > 0 Y el hábito trae `rescuableDate` no nulo.',
  })
  streakShields: number;

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
    dto.monthlyServicesGroupBy = settings.monthlyServicesGroupBy;
    dto.monthlyServicesOrderBy = settings.monthlyServicesOrderBy;
    dto.monthlyServicesOrderDir = settings.monthlyServicesOrderDir;
    dto.favoriteKeys = settings.favoriteKeys;
    dto.disabledModules = settings.disabledModules;
    dto.streakShields = settings.streakShields;
    dto.createdAt = settings.createdAt;
    dto.updatedAt = settings.updatedAt;
    return dto;
  }
}
