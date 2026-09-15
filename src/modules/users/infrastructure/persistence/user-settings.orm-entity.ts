import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Currency } from '@common/enums/currency.enum';

import { DateFormat } from '../../domain/enums/date-format.enum';
import { Language } from '../../domain/enums/language.enum';
import { MonthlyServicesGroupBy } from '../../domain/enums/monthly-services-group-by.enum';
import { MonthlyServicesOrderBy } from '../../domain/enums/monthly-services-order-by.enum';
import { MonthlyServicesOrderDir } from '../../domain/enums/monthly-services-order-dir.enum';
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

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone: string;

  // VARCHAR + CHECK (declared in the migration) keeps these specific to the
  // monthly-services UI without polluting the global enum types.
  @Column({ type: 'varchar', length: 20, default: MonthlyServicesGroupBy.NONE })
  monthlyServicesGroupBy: MonthlyServicesGroupBy;

  @Column({ type: 'varchar', length: 24, default: MonthlyServicesOrderBy.NAME })
  monthlyServicesOrderBy: MonthlyServicesOrderBy;

  @Column({ type: 'varchar', length: 4, default: MonthlyServicesOrderDir.ASC })
  monthlyServicesOrderDir: MonthlyServicesOrderDir;

  /**
   * Postgres `text[]` so order matters (mobile bottom-nav slot order is
   * the array order) and equality checks stay simple. The cap (≤ 4) is
   * enforced at two layers — DTO validator and SQL `CHECK` constraint
   * declared in migration 1741000023000.
   *
   * The default must stay in sync with `DEFAULT_FAVORITES` in the web repo
   * (`src/lib/nav-registry.ts`). A key here that names a route the frontend
   * dropped still counts toward the ≤ 4 cap while rendering nothing, which
   * soft-locks the user out of managing their own favorites — see migration
   * 1741000044000.
   */
  @Column({
    type: 'text',
    array: true,
    default: () => `ARRAY['debts','budgets','habits','quick-tasks']::text[]`,
  })
  favoriteKeys: string[];

  /**
   * Nav keys the user has switched OFF in Settings. Hidden from the sidebar
   * and mobile nav, from their slice of the reports dashboards, and from the
   * alerts popover.
   *
   * Empty by default — every module on. The set of valid keys lives in the
   * frontend's `NAV_REGISTRY`, same decoupling as `favoriteKeys`. Uncapped on
   * purpose: disabling everything is a legitimate state, and Settings is never
   * in this list, so the user can always switch things back on.
   */
  @Column({ type: 'text', array: true, default: () => `'{}'::text[]` })
  disabledModules: string[];

  /**
   * Streak shields in hand, 0..2. The DB enforces the cap with a CHECK
   * (migration 1741000046000) rather than trusting the grant path — the cap
   * is what gives a shield its weight.
   *
   * Every user STARTS with one (migration 1741000047000). The mechanic only
   * teaches itself when a streak is actually at risk, and a user at zero meets
   * it as a button they cannot press.
   */
  @Column({ type: 'smallint', default: 1 })
  streakShields: number;

  /**
   * `YYYY-MM` of the month a shield was last granted, or null if never. One
   * column instead of a grants table because the only question ever asked is
   * "was one already granted this month".
   */
  @Column({ type: 'varchar', length: 7, nullable: true })
  shieldsEarnedMonth: string | null;

  /**
   * Timestamp the user last opened the alerts popover. Drives the bell
   * badge — alerts whose `triggeredAt > lastAlertsSeenAt` are counted as
   * unread. Null until the user opens the popover for the first time.
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastAlertsSeenAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
