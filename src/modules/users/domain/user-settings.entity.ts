import { type Currency } from '@common/enums/currency.enum';

import { type DateFormat } from './enums/date-format.enum';
import { type Language } from './enums/language.enum';
import { type MonthlyServicesGroupBy } from './enums/monthly-services-group-by.enum';
import { type MonthlyServicesOrderBy } from './enums/monthly-services-order-by.enum';
import { type MonthlyServicesOrderDir } from './enums/monthly-services-order-dir.enum';
import { type StartOfWeek } from './enums/start-of-week.enum';
import { type Theme } from './enums/theme.enum';

/**
 * How many streak shields a user can hold at once.
 *
 * The cap is the mechanic. Without it a daily user accumulates a dozen in a
 * year and a broken streak stops costing anything — which is the only reason
 * a streak motivates in the first place. A shield earned on a full stock is
 * LOST, deliberately.
 */
export const MAX_STREAK_SHIELDS = 2;

/** Consecutive periods a habit must reach before it earns that month's shield. */
export const SHIELD_STREAK_THRESHOLD = 20;

export class UserSettings {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public language: Language,
    public theme: Theme,
    public defaultCurrency: Currency,
    public dateFormat: DateFormat,
    public startOfWeek: StartOfWeek,
    public timezone: string,
    // Monthly-services view preferences. Persisted here (instead of a separate
    // preferences table) because every other UI preference lives in user_settings.
    public monthlyServicesGroupBy: MonthlyServicesGroupBy,
    public monthlyServicesOrderBy: MonthlyServicesOrderBy,
    public monthlyServicesOrderDir: MonthlyServicesOrderDir,
    /**
     * User-picked keys (max 4) that drive the mobile bottom nav and the
     * "★ favorite" mark in the desktop sidebar. The canonical list of
     * available keys lives in the frontend's `NAV_REGISTRY` — we keep
     * this side dumb-strings on purpose so we don't have to bump backend
     * + frontend in lockstep every time a nav route is added or renamed.
     * Frontend ignores unknown keys gracefully.
     */
    public favoriteKeys: string[],
    /**
     * Nav keys the user has switched OFF in Settings. The frontend hides
     * these from the sidebar and mobile nav, from their slice of the reports
     * dashboards, and from the alerts popover.
     *
     * Same dumb-strings contract as `favoriteKeys` — the canonical module list
     * lives in the frontend's `NAV_REGISTRY`. Empty means everything is on,
     * which is why the column defaults to `{}`: opting out is the exception,
     * so a new module is on for everyone without touching a single row.
     */
    public disabledModules: string[],
    /** Streak shields in hand, 0..{@link MAX_STREAK_SHIELDS}. */
    public streakShields: number,
    /** `YYYY-MM` of the month a shield was last granted; null if never. */
    public shieldsEarnedMonth: string | null,
    /**
     * Timestamp the user last opened the alerts popover. Drives the bell
     * badge: an alert is considered unread when its `triggeredAt` is newer
     * than this. Null = the user has never opened the popover.
     *
     * Updated by `MarkAlertsSeenUseCase` (in the alerts module) on every
     * popover open. We deliberately use a single timestamp instead of a
     * per-alert seen flag — the bell only needs "any new ones since I last
     * checked", and one column is cheaper than a join.
     */
    public lastAlertsSeenAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  /**
   * Bump `lastAlertsSeenAt` to `now`. Separate from `update()` because
   * the alerts use case doesn't want to touch any other field — and
   * crucially shouldn't bump `updatedAt`, which would invalidate the
   * `useUserSettings` query on the web every time the user opens the
   * popover.
   */
  markAlertsSeen(now: Date): void {
    this.lastAlertsSeenAt = now;
  }

  /**
   * Grants this month's streak shield if `streak` has earned it. Returns
   * whether the stock actually went up.
   *
   * `currentMonth` is `YYYY-MM` in the USER's timezone — the server's month is
   * not theirs, and on the 1st or the 31st the two disagree.
   *
   * The month is stamped even when the stock is full, and that is the
   * "a shield earned at full stock is lost" rule in one line: the reward is
   * forfeited, not deferred. Skipping the stamp would let a user bank months
   * while full and cash them all in after spending one — exactly the
   * accumulation the cap exists to prevent.
   */
  grantShieldIfEarned(currentMonth: string, streak: number): boolean {
    if (streak < SHIELD_STREAK_THRESHOLD) return false;
    if (this.shieldsEarnedMonth === currentMonth) return false;

    this.shieldsEarnedMonth = currentMonth;
    this.updatedAt = new Date();

    if (this.streakShields >= MAX_STREAK_SHIELDS) return false;
    this.streakShields += 1;
    return true;
  }

  /**
   * Spends one shield. Callers check `streakShields` first and raise the
   * mapped domain error; this guard is the last line, so a future caller
   * cannot drive the stock negative past the DB's CHECK and get a 500
   * instead of a 4xx.
   */
  spendShield(): void {
    if (this.streakShields <= 0) {
      throw new Error('No streak shields available');
    }
    this.streakShields -= 1;
    this.updatedAt = new Date();
  }

  update(partial: {
    language?: Language;
    theme?: Theme;
    defaultCurrency?: Currency;
    dateFormat?: DateFormat;
    startOfWeek?: StartOfWeek;
    timezone?: string;
    monthlyServicesGroupBy?: MonthlyServicesGroupBy;
    monthlyServicesOrderBy?: MonthlyServicesOrderBy;
    monthlyServicesOrderDir?: MonthlyServicesOrderDir;
    favoriteKeys?: string[];
    disabledModules?: string[];
  }): void {
    if (partial.language !== undefined) this.language = partial.language;
    if (partial.theme !== undefined) this.theme = partial.theme;
    if (partial.defaultCurrency !== undefined) this.defaultCurrency = partial.defaultCurrency;
    if (partial.dateFormat !== undefined) this.dateFormat = partial.dateFormat;
    if (partial.startOfWeek !== undefined) this.startOfWeek = partial.startOfWeek;
    if (partial.timezone !== undefined) this.timezone = partial.timezone;
    if (partial.monthlyServicesGroupBy !== undefined)
      this.monthlyServicesGroupBy = partial.monthlyServicesGroupBy;
    if (partial.monthlyServicesOrderBy !== undefined)
      this.monthlyServicesOrderBy = partial.monthlyServicesOrderBy;
    if (partial.monthlyServicesOrderDir !== undefined)
      this.monthlyServicesOrderDir = partial.monthlyServicesOrderDir;
    if (partial.favoriteKeys !== undefined) this.favoriteKeys = partial.favoriteKeys;
    if (partial.disabledModules !== undefined) this.disabledModules = partial.disabledModules;
    this.updatedAt = new Date();
  }
}
