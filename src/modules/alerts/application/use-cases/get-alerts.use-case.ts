import { Injectable } from '@nestjs/common';

import { BudgetMovementRepository } from '@modules/budget-movements/domain/budget-movement.repository';
import { BudgetRepository } from '@modules/budgets/domain/budget.repository';
import { currentMonthInTimezone } from '@modules/budgets/infrastructure/timezone/current-month-in-timezone';
import { ChoreRepository } from '@modules/chores/domain/chore.repository';
import { HabitFrequency } from '@modules/habits/domain/enums/habit-frequency.enum';
import { HabitRepository } from '@modules/habits/domain/habit.repository';
import { HabitLogRepository } from '@modules/habits/domain/habit-log.repository';
import { MonthlyServiceRepository } from '@modules/monthly-services/domain/monthly-service.repository';
import { currentPeriodInTimezone } from '@modules/monthly-services/infrastructure/timezone/current-period-in-timezone';
import { dayInTimezone } from '@modules/monthly-services/infrastructure/timezone/day-in-timezone';
import { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

import { Alert } from '../../domain/alert.entity';
import {
  budgetUnloggedId,
  choreDueTodayId,
  choreOverdueId,
  habitsMiddayId,
  serviceDueTodayId,
  serviceOverdueId,
} from '../../domain/alert-id';
import { AlertSeverity } from '../../domain/enums/alert-severity.enum';
import { AlertType } from '../../domain/enums/alert-type.enum';
import { UserAlertDismissalRepository } from '../../domain/user-alert-dismissal.repository';
import { hourInTimezone } from '../../infrastructure/timezone/hour-in-timezone';

const MIDDAY_HOUR = 12;

/**
 * Earliest local hour the budget-unlogged nudge may fire.
 *
 * It asks "did you forget to log an expense?" — at 7am the honest answer is
 * "no, I just haven't spent anything yet", so the alert was reading as noise
 * every morning. 11 is late enough that a normal day has had a chance to
 * produce a expense, and early enough to still be actionable.
 */
const BUDGET_UNLOGGED_EARLIEST_HOUR = 11;

/**
 * Consecutive no-movement days (ending today) that trip the budget-unlogged
 * nudge. 2 — since daily basics get logged every day, two silent days almost
 * always means "forgot to register", not genuinely no spending.
 */
const MIN_UNLOGGED_DAYS = 2;

export interface GetAlertsResult {
  /** Alerts visible to the user RIGHT NOW (post-dismiss filter). */
  alerts: Alert[];
  /** Timestamp from user_settings.lastAlertsSeenAt — drives the bell badge. */
  lastSeenAt: Date | null;
}

/**
 * Resolves the user's currently-visible alerts from the rest of the modules.
 *
 * The set of alerts is recomputed every call — there's no persisted alerts
 * table. We pull the latest state from monthly-services / habits / budgets /
 * chores, build synthetic `Alert` objects, then filter out anything the user
 * has dismissed (still-active per-day dismissals).
 *
 * The midday gate for `habits-midday` lives here — only includes the alert
 * when the user's local hour is >= 12. The frontend doesn't need to know.
 */
@Injectable()
export class GetAlertsForUserUseCase {
  constructor(
    private readonly servicesRepo: MonthlyServiceRepository,
    private readonly habitsRepo: HabitRepository,
    private readonly habitLogsRepo: HabitLogRepository,
    private readonly budgetsRepo: BudgetRepository,
    private readonly budgetMovementRepo: BudgetMovementRepository,
    private readonly choresRepo: ChoreRepository,
    private readonly userSettingsRepo: UserSettingsRepository,
    private readonly dismissalsRepo: UserAlertDismissalRepository,
  ) {}

  async execute(
    userId: string,
    timezone: string,
    now: Date = new Date(),
  ): Promise<GetAlertsResult> {
    // 1) Read the user's lastSeenAt from settings — drives the bell badge.
    const settings = await this.userSettingsRepo.findByUserId(userId);
    const lastSeenAt = settings?.lastAlertsSeenAt ?? null;

    // 2) Resolve the current period + today + hour in the user's TZ. These
    // are the cardinal anchors for every trigger below.
    const currentPeriod = currentPeriodInTimezone(timezone, now);
    const { year, month } = currentMonthInTimezone(timezone, now);
    const today = formatLocalDate(timezone, now);
    const currentHour = hourInTimezone(timezone, now);

    // 3) Build candidate alerts from every module in parallel.
    const [serviceAlerts, habitsAlert, budgetAlerts, choreAlerts] = await Promise.all([
      this.buildServiceAlerts(userId, currentPeriod, timezone, now),
      this.buildHabitsMiddayAlert(userId, today, currentHour, now),
      this.buildBudgetAlerts(userId, year, month, today, timezone, currentHour, now),
      this.buildChoreAlerts(userId, today),
    ]);

    const candidates: Alert[] = [
      ...serviceAlerts,
      ...(habitsAlert ? [habitsAlert] : []),
      ...budgetAlerts,
      ...choreAlerts,
    ];

    // 4) Filter out alerts whose ID has an active dismissal row.
    const dismissals = await this.dismissalsRepo.findByUserId(userId);
    const activeDismissedIds = new Set(
      dismissals.filter((d) => d.isActiveAt(now)).map((d) => d.alertId),
    );
    const visible = candidates.filter((a) => !activeDismissedIds.has(a.id));

    return { alerts: visible, lastSeenAt };
  }

  // -- per-trigger builders ---------------------------------------------------

  /**
   * Service triggers — two types:
   *  - SERVICE_DUE_TODAY: service that is due this calendar month and not yet
   *    paid. `triggeredAt` set to the first of the user's current period so
   *    the badge counts "new this month" alerts.
   *  - SERVICE_OVERDUE: service whose nextDuePeriod is earlier than current.
   *    `triggeredAt` set to the first of the overdue period — older alerts
   *    naturally end up with older triggeredAt, but lastSeenAt collapses them
   *    after the first popover open.
   */
  private async buildServiceAlerts(
    userId: string,
    currentPeriod: string,
    timezone: string,
    now: Date,
  ): Promise<Alert[]> {
    const services = await this.servicesRepo.findByUserId(userId, false);
    const alerts: Alert[] = [];
    for (const service of services) {
      if (!service.isActive) continue;
      if (service.isOverdueFor(currentPeriod)) {
        const overduePeriod = service.nextDuePeriod();
        alerts.push(
          new Alert(
            serviceOverdueId(service.id),
            AlertType.SERVICE_OVERDUE,
            AlertSeverity.WARNING,
            startOfPeriodUTC(overduePeriod),
            {
              serviceId: service.id,
              serviceName: service.name,
              overduePeriod,
              currency: service.currency,
              estimatedAmount: service.estimatedAmount,
            },
          ),
        );
        continue; // Don't ALSO mark it as "due today" — overdue is more specific.
      }
      // Fires from the service's due day ONWARD, not on that day alone.
      //
      // `dueDay` is presented to the user as "Día aproximado de vencimiento —
      // solo para ordenar y recordar", so matching it with `===` read an
      // approximate value as an exact one: the alert existed for a single day
      // a month, and not opening the app that day meant missing it entirely.
      // Bills are paid on or after their reference date.
      //
      // This is NOT a revert of the earlier fix that introduced the day check.
      // That fix stopped the alert firing all month long — a day-29 service
      // announcing itself on the 11th. `>=` keeps it silent before the due day
      // and only starts once the date the user wrote down has arrived, which
      // is what the original bug was actually about.
      //
      // The alert ID is scoped to the period while the dismissal is per-day,
      // so closing it hides it until the user's midnight and it returns the
      // next day — nagging daily from the due day until paid, which is the
      // intended behaviour here rather than an oversight.
      if (
        service.nextDuePeriod() === currentPeriod &&
        service.dueDay !== null &&
        dayInTimezone(now, timezone) >= service.dueDay &&
        !service.isPaidForMonth(currentPeriod)
      ) {
        alerts.push(
          new Alert(
            serviceDueTodayId(service.id, currentPeriod),
            AlertType.SERVICE_DUE_TODAY,
            AlertSeverity.INFO,
            // Use the start of the current period as the "first appeared"
            // anchor. A new month = a fresh ID + a fresh triggeredAt.
            startOfPeriodUTC(currentPeriod),
            {
              serviceId: service.id,
              serviceName: service.name,
              dueDay: service.dueDay,
              currency: service.currency,
              estimatedAmount: service.estimatedAmount,
            },
          ),
        );
      }
    }
    return alerts;
  }

  /**
   * Habits midday — single alert per user when they have at least one DAILY
   * habit with no log for today AFTER noon in the user's local time.
   *
   * The mediodía gate is HERE so the frontend stays dumb — it just renders
   * whatever the endpoint returns. Before noon the endpoint excludes this
   * trigger entirely.
   */
  private async buildHabitsMiddayAlert(
    userId: string,
    today: string,
    currentHour: number,
    now: Date,
  ): Promise<Alert | null> {
    if (currentHour < MIDDAY_HOUR) return null;

    const habits = await this.habitsRepo.findByUserId(userId, false);
    const dailyActive = habits.filter((h) => !h.isArchived && h.frequency === HabitFrequency.DAILY);
    if (dailyActive.length === 0) return null;

    const logsToday = await this.habitLogsRepo.findByUserIdAndDate(userId, today);
    const loggedHabitIds = new Set(logsToday.map((l) => l.habitId));
    const missing = dailyActive.filter((h) => !loggedHabitIds.has(h.id));
    if (missing.length === 0) return null;

    return new Alert(
      habitsMiddayId(today),
      AlertType.HABITS_MIDDAY,
      AlertSeverity.INFO,
      // Anchor: noon in the user's TZ today. We don't have a direct "now in
      // user TZ" Date to use — `now` is server-clock-correct, and the user's
      // local midday is some other UTC instant. Using `now` is good enough
      // (the badge just needs strictly-monotonic ordering vs lastSeenAt).
      now,
      {
        missingCount: missing.length,
        firstHabitName: missing[0].name,
      },
    );
  }

  /**
   * Budget unlogged — one per active budget in the current month that still
   * has money left (`amount - spent > 0`) yet has gone `MIN_UNLOGGED_DAYS`+
   * consecutive days with no movements ending today. Since daily basics
   * (food, essentials) get logged every day, a gap means the user likely
   * FORGOT to register an expense — so this is a "did you forget?" nudge,
   * not an overspend warning.
   *
   * We pull all budgets (no period filter on the repo) and discard
   * non-current ones in-app; budgets are typically <12 rows per user.
   *
   * Gated to `BUDGET_UNLOGGED_EARLIEST_HOUR` in the user's TZ — same shape as
   * the habits-midday gate, and for the same reason: a "did you forget?"
   * question asked at breakfast is about a day that hasn't happened yet.
   */
  private async buildBudgetAlerts(
    userId: string,
    year: number,
    month: number,
    today: string,
    timezone: string,
    currentHour: number,
    now: Date,
  ): Promise<Alert[]> {
    if (currentHour < BUDGET_UNLOGGED_EARLIEST_HOUR) return [];

    const budgets = await this.budgetsRepo.findByUserId(userId);
    const current = budgets.filter((b) => b.year === year && b.month === month && !b.isDeleted());
    if (current.length === 0) return [];

    // Movements per budget in parallel — small N so the fan-out is fine.
    // v1.0.0: reads from `budget_movements` (the dedicated v1.0.0 module),
    // NOT the legacy `transactions` tagged with `budgetId`.
    const movementsPerBudget = await Promise.all(
      current.map((b) => this.budgetMovementRepo.findByBudgetId(b.id)),
    );

    const alerts: Alert[] = [];
    current.forEach((budget, i) => {
      const movements = movementsPerBudget[i].filter((m) => !m.isDeleted());
      const spent = movements.reduce((acc, m) => acc + m.amount, 0);
      const remaining = budget.amount - spent;
      if (remaining <= 0) return;

      // Days (in the user's TZ) that already have at least one movement.
      const spentDays = new Set(movements.map((m) => formatLocalDate(timezone, m.date)));

      // Walk back from today counting consecutive no-movement days, stopping
      // at the first day with spend or when we leave the current period.
      const period = today.slice(0, 7);
      let streak = 0;
      let cursor = today;
      while (cursor.slice(0, 7) === period && !spentDays.has(cursor)) {
        streak += 1;
        cursor = previousDay(cursor);
      }

      if (streak < MIN_UNLOGGED_DAYS) return;

      alerts.push(
        new Alert(
          budgetUnloggedId(budget.id, today),
          AlertType.BUDGET_UNLOGGED,
          AlertSeverity.INFO,
          now,
          {
            budgetId: budget.id,
            currency: budget.currency,
            remaining,
            days: streak,
          },
        ),
      );
    });
    return alerts;
  }

  /**
   * Chore triggers — two types, mutually exclusive per chore because
   * `nextDueDate` is either before today or equal to it, never both:
   *  - CHORE_OVERDUE: `nextDueDate < today`. Persistent, WARNING.
   *  - CHORE_DUE_TODAY: `nextDueDate === today`. Per-day, INFO.
   *
   * Neither is hour-gated. Unlike the budget nudge, these are not asking the
   * user to reflect on a day that hasn't happened — the chore is on for today
   * from the moment today starts. And the alert only surfaces inside the bell
   * popover, so "too early" isn't a thing: the user is the one opening it.
   */
  private async buildChoreAlerts(userId: string, today: string): Promise<Alert[]> {
    const chores = await this.choresRepo.findByUserId(userId, false);
    const alerts: Alert[] = [];
    for (const chore of chores) {
      if (!chore.isActive) continue;
      if (chore.isOverdueFor(today)) {
        alerts.push(
          new Alert(
            choreOverdueId(chore.id),
            AlertType.CHORE_OVERDUE,
            AlertSeverity.WARNING,
            // Anchor: the day the chore went overdue (start of nextDueDate UTC).
            // Earlier overdues read as older alerts — useful when the user
            // ignores them for a few days.
            startOfDateUTC(chore.nextDueDate),
            {
              choreId: chore.id,
              choreName: chore.name,
              nextDueDate: chore.nextDueDate,
            },
          ),
        );
        continue; // Overdue already covers this chore — don't also say "today".
      }
      if (chore.nextDueDate === today) {
        alerts.push(
          new Alert(
            choreDueTodayId(chore.id, today),
            AlertType.CHORE_DUE_TODAY,
            AlertSeverity.INFO,
            // Anchor: the start of today. A fresh day = a fresh ID and a fresh
            // triggeredAt, so the bell badge counts it as new.
            startOfDateUTC(today),
            {
              choreId: chore.id,
              choreName: chore.name,
              nextDueDate: chore.nextDueDate,
            },
          ),
        );
      }
    }
    return alerts;
  }
}

/** The `YYYY-MM-DD` calendar day before the given `YYYY-MM-DD` (UTC math). */
function previousDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` of `now` in the given IANA timezone. */
function formatLocalDate(timezone: string, now: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(now);
    const pick = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  } catch {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/** First-day-of-period (`YYYY-MM-01`) as a UTC `Date`. */
function startOfPeriodUTC(period: string): Date {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}

/** `YYYY-MM-DD` as a UTC `Date`. */
function startOfDateUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}
