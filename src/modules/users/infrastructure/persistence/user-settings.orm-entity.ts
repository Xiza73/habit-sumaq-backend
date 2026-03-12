import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Currency } from '@modules/accounts/domain/enums/currency.enum';

import { DateFormat } from '../../domain/enums/date-format.enum';
import { Language } from '../../domain/enums/language.enum';
import { StartOfWeek } from '../../domain/enums/start-of-week.enum';
import { Theme } from '../../domain/enums/theme.enum';

@Entity('user_settings')
@Index('IDX_user_settings_userId', ['userId'], { unique: true })
export class UserSettingsOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: Language,
    enumName: 'language_enum',
    default: Language.ES,
  })
  language: Language;

  @Column({
    type: 'enum',
    enum: Theme,
    enumName: 'theme_enum',
    default: Theme.SYSTEM,
  })
  theme: Theme;

  @Column({
    type: 'enum',
    enum: Currency,
    enumName: 'currency_enum',
    default: Currency.PEN,
  })
  defaultCurrency: Currency;

  @Column({
    type: 'enum',
    enum: DateFormat,
    enumName: 'date_format_enum',
    default: DateFormat.DD_MM_YYYY,
  })
  dateFormat: DateFormat;

  @Column({
    type: 'enum',
    enum: StartOfWeek,
    enumName: 'start_of_week_enum',
    default: StartOfWeek.MONDAY,
  })
  startOfWeek: StartOfWeek;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
