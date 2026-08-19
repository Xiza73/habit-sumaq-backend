import { Currency } from '@common/enums/currency.enum';
import { buildBudgetMovement } from '@modules/budget-movements/domain/__tests__/budget-movement.factory';
import { makeBudget } from '@modules/budgets/domain/__tests__/budget.factory';
import { buildChore } from '@modules/chores/domain/__tests__/chore.factory';
import { buildHabit } from '@modules/habits/domain/__tests__/habit.factory';
import { HabitFrequency } from '@modules/habits/domain/enums/habit-frequency.enum';
import { HabitLog } from '@modules/habits/domain/habit-log.entity';
import { buildMonthlyService } from '@modules/monthly-services/domain/__tests__/monthly-service.factory';
import { Reminder } from '@modules/reminders/domain/reminder.entity';
import { type ReminderRepository } from '@modules/reminders/domain/reminder.repository';
import { buildUserSettings } from '@modules/users/domain/__tests__/user-settings.factory';

import { isDismissable } from '../../../domain/alert-dismiss-policy';
import { AlertType } from '../../../domain/enums/alert-type.enum';
import { UserAlertDismissal } from '../../../domain/user-alert-dismissal.entity';
import { GetAlertsForUserUseCase } from '../get-alerts.use-case';

import type { UserAlertDismissalRepository } from '../../../domain/user-alert-dismissal.repository';
import type { BudgetMovement } from '@modules/budget-movements/domain/budget-movement.entity';
import type { BudgetMovementRepository } from '@modules/budget-movements/domain/budget-movement.repository';
import type { BudgetRepository } from '@modules/budgets/domain/budget.repository';
import type { ChoreRepository } from '@modules/chores/domain/chore.repository';
import type { HabitRepository } from '@modules/habits/domain/habit.repository';
import type { HabitLogRepository } from '@modules/habits/domain/habit-log.repository';
import type { MonthlyServiceRepository } from '@modules/monthly-services/domain/monthly-service.repository';
import type { UserSettingsRepository } from '@modules/users/domain/user-settings.repository';

const USER_ID = 'user-1';
const TZ = 'America/Lima'; // UTC-5, no DST
// Tests pin a fixed `now`: 2026-05-19 17:00 UTC = 12:00 Lima (post-noon).
const NOW = new Date('2026-05-19T17:00:00.000Z');

function buildUseCase(
  overrides: Partial<{
    services: ReturnType<typeof buildMonthlyService>[];
    habits: ReturnType<typeof buildHabit>[];
    habitLogs: HabitLog[];
    budgets: ReturnType<typeof makeBudget>[];
    budgetMovementsMap: Map<string, BudgetMovement[]>;
    chores: ReturnType<typeof buildChore>[];
    reminders: Reminder[];
    dismissals: UserAlertDismissal[];
    lastAlertsSeenAt: Date | null;
  }>,
): { useCase: GetAlertsForUserUseCase; spies: Record<string, jest.Mock> } {
  const services = overrides.services ?? [];
  const habits = overrides.habits ?? [];
  const habitLogs = overrides.habitLogs ?? [];
  const budgets = overrides.budgets ?? [];
  const budgetMovementsMap = overrides.budgetMovementsMap ?? new Map<string, BudgetMovement[]>();
  const chores = overrides.chores ?? [];
  const reminders = overrides.reminders ?? [];
  const dismissals = overrides.dismissals ?? [];

  const servicesRepo: jest.Mocked<MonthlyServiceRepository> = {
    findByUserId: jest.fn().mockResolvedValue(services),
    findById: jest.fn(),
    findActiveByUserIdAndName: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const habitsRepo: jest.Mocked<HabitRepository> = {
    findByUserId: jest.fn().mockResolvedValue(habits),
    findByUserIdAndName: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const habitLogsRepo: jest.Mocked<HabitLogRepository> = {
    findByHabitIdAndDate: jest.fn(),
    findByHabitId: jest.fn(),
    findByUserIdAndDate: jest.fn().mockResolvedValue(habitLogs),
    findCompletedByHabitId: jest.fn(),
    findByHabitIdAndDateRange: jest.fn(),
    save: jest.fn(),
    softDeleteByHabitId: jest.fn(),
  };

  const budgetsRepo: jest.Mocked<BudgetRepository> = {
    findByUserId: jest.fn().mockResolvedValue(budgets),
    findById: jest.fn(),
    findByPeriodAndCurrency: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  // v1.0.0: budget alerts read movements from the new `budget_movements`
  // table, not legacy `transactions`. The unlogged-days nudge needs per-day
  // granularity, so it pulls the full movement list per budget.
  const budgetMovementRepo = {
    findByBudgetId: jest.fn((id: string) => Promise.resolve(budgetMovementsMap.get(id) ?? [])),
  } as unknown as BudgetMovementRepository;

  const choresRepo: jest.Mocked<ChoreRepository> = {
    findByUserId: jest.fn().mockResolvedValue(chores),
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const remindersRepo: jest.Mocked<ReminderRepository> = {
    findByUserId: jest.fn().mockResolvedValue(reminders),
    findById: jest.fn(),
    save: jest.fn(),
    deleteById: jest.fn(),
  };

  const userSettingsRepo: jest.Mocked<UserSettingsRepository> = {
    findByUserId: jest.fn().mockResolvedValue(
      buildUserSettings({
        userId: USER_ID,
        lastAlertsSeenAt: overrides.lastAlertsSeenAt ?? null,
      }),
    ),
    create: jest.fn(),
    save: jest.fn(),
  };

  const dismissalsRepo: jest.Mocked<UserAlertDismissalRepository> = {
    findByUserId: jest.fn().mockResolvedValue(dismissals),
    upsert: jest.fn(),
  };

  const useCase = new GetAlertsForUserUseCase(
    servicesRepo,
    habitsRepo,
    habitLogsRepo,
    budgetsRepo,
    budgetMovementRepo,
    choresRepo,
    remindersRepo,
    userSettingsRepo,
    dismissalsRepo,
  );

  return {
    useCase,
    spies: {
      servicesFind: servicesRepo.findByUserId as jest.Mock,
      habitsFind: habitsRepo.findByUserId as jest.Mock,
      habitLogsFind: habitLogsRepo.findByUserIdAndDate as jest.Mock,
      budgetsFind: budgetsRepo.findByUserId as jest.Mock,
      choresFind: choresRepo.findByUserId as jest.Mock,
      dismissalsFind: dismissalsRepo.findByUserId as jest.Mock,
    },
  };
}

describe('GetAlertsForUserUseCase', () => {
  it('returns an empty list + null lastSeenAt when the user has no data', async () => {
    const { useCase } = buildUseCase({});
    const result = await useCase.execute(USER_ID, TZ, NOW);
    expect(result.alerts).toEqual([]);
    expect(result.lastSeenAt).toBeNull();
  });

  describe('reminder triggers', () => {
    // NOW is 2026-05-19T17:00Z = 12:00 in Lima.
    function buildReminder(
      over: Partial<{
        id: string;
        title: string;
        remindDate: string | null;
        remindTime: string | null;
        completed: boolean;
      }> = {},
    ): Reminder {
      const now = new Date('2026-05-01T00:00:00.000Z');
      return new Reminder(
        over.id ?? 'rem-1',
        USER_ID,
        over.title ?? 'Llamar al dentista',
        null,
        over.remindDate !== undefined ? over.remindDate : '2026-05-19',
        over.remindTime !== undefined ? over.remindTime : null,
        over.completed ?? false,
        null,
        now,
        now,
      );
    }

    it('emits REMINDER_DUE for a dated reminder whose day has arrived', async () => {
      const { useCase } = buildUseCase({ reminders: [buildReminder()] });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe(AlertType.REMINDER_DUE);
      expect(result.alerts[0].payload.title).toBe('Llamar al dentista');
    });

    it('never emits for a reminder with no date — a note is not a nag', async () => {
      const { useCase } = buildUseCase({ reminders: [buildReminder({ remindDate: null })] });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts).toEqual([]);
    });

    it('does not emit before the day arrives', async () => {
      const { useCase } = buildUseCase({
        reminders: [buildReminder({ remindDate: '2026-05-20' })],
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts).toEqual([]);
    });

    it('keeps emitting after the day has passed — it is still not done', async () => {
      const { useCase } = buildUseCase({
        reminders: [buildReminder({ remindDate: '2026-05-10' })],
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.REMINDER_DUE]);
    });

    it('waits for the hour on the reminder own day', async () => {
      const before = buildUseCase({
        reminders: [buildReminder({ remindTime: '15:00' })],
      });
      expect((await before.useCase.execute(USER_ID, TZ, NOW)).alerts).toEqual([]);

      const after = buildUseCase({
        reminders: [buildReminder({ remindTime: '11:00' })],
      });
      expect((await after.useCase.execute(USER_ID, TZ, NOW)).alerts).toHaveLength(1);
    });

    it('ignores the hour once the day has passed', async () => {
      // A 23:00 reminder from last week must not hide every morning and
      // resurface at 23:00 — that is how you lose it.
      const { useCase } = buildUseCase({
        reminders: [buildReminder({ remindDate: '2026-05-10', remindTime: '23:00' })],
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts).toHaveLength(1);
    });

    it('stops once completed', async () => {
      const { useCase } = buildUseCase({ reminders: [buildReminder({ completed: true })] });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts).toEqual([]);
    });

    it('scopes the id to TODAY, not to the reminder date, so a dismiss lasts one day', async () => {
      // Keying the id on `remindDate` would freeze it, and one dismiss would
      // silence an overdue reminder permanently.
      const { useCase } = buildUseCase({
        reminders: [buildReminder({ id: 'rem-9', remindDate: '2026-05-10' })],
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts[0].id).toBe('reminder-due:rem-9:2026-05-19');
    });
  });

  describe('service triggers', () => {
    it('emits SERVICE_DUE_TODAY for a service whose nextDuePeriod matches the current period and is unpaid', async () => {
      const service = buildMonthlyService({
        startPeriod: '2026-05',
        lastPaidPeriod: null,
        currency: 'PEN',
        estimatedAmount: 45,
        dueDay: 19, // matches NOW's day-of-month in Lima → "due today"
      });
      const { useCase } = buildUseCase({ services: [service] });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts).toHaveLength(1);
      const alert = result.alerts[0];
      expect(alert.type).toBe(AlertType.SERVICE_DUE_TODAY);
      expect(alert.id).toBe(`service-due-today:${service.id}:2026-05`);
      expect(alert.payload.serviceId).toBe(service.id);
      expect(alert.payload.estimatedAmount).toBe(45);
    });

    it('does NOT emit SERVICE_DUE_TODAY before the due day arrives', async () => {
      // Due on the 29th, but today (Lima) is the 19th → not due yet. This is
      // the case the day check was originally added for: without it the alert
      // announced itself all month long.
      const service = buildMonthlyService({
        startPeriod: '2026-05',
        lastPaidPeriod: null,
        dueDay: 29,
      });
      const { useCase } = buildUseCase({ services: [service] });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts).toEqual([]);
    });

    it('KEEPS emitting SERVICE_DUE_TODAY after the due day, because it is approximate', async () => {
      // `dueDay` is "Día aproximado de vencimiento". Matching it exactly gave
      // the alert a one-day life: miss that day and you miss it entirely.
      // Due on the 15th, today is the 19th, still unpaid → still actionable.
      const service = buildMonthlyService({
        startPeriod: '2026-05',
        lastPaidPeriod: null,
        dueDay: 15,
      });
      const { useCase } = buildUseCase({ services: [service] });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.SERVICE_DUE_TODAY]);
    });

    it('emits from day 1 for a service due on the 1st', async () => {
      const service = buildMonthlyService({
        startPeriod: '2026-05',
        lastPaidPeriod: null,
        dueDay: 1,
      });
      const { useCase } = buildUseCase({ services: [service] });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.SERVICE_DUE_TODAY]);
    });

    it('does NOT emit for a service with no due day at all', async () => {
      // `dueDay` is nullable and there is no anchor to count from, so the
      // service stays silent rather than guessing a date the user never set.
      const service = buildMonthlyService({
        startPeriod: '2026-05',
        lastPaidPeriod: null,
        dueDay: null,
      });
      const { useCase } = buildUseCase({ services: [service] });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts).toEqual([]);
    });

    it('does NOT emit once the service is paid, even past the due day', async () => {
      // Paid for May → nextDuePeriod moves to June, so it is neither due nor
      // overdue. Passing the due day again is not a prompt.
      const service = buildMonthlyService({
        startPeriod: '2026-05',
        lastPaidPeriod: '2026-05',
        dueDay: 15,
      });
      const { useCase } = buildUseCase({ services: [service] });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts).toEqual([]);
    });

    it('emits SERVICE_OVERDUE for a service whose nextDuePeriod is earlier than current', async () => {
      // lastPaidPeriod=Feb + freq=1 → nextDue=Mar. Current=May → overdue.
      const service = buildMonthlyService({ startPeriod: '2026-01', lastPaidPeriod: '2026-02' });
      const { useCase } = buildUseCase({ services: [service] });
      const result = await useCase.execute(USER_ID, TZ, NOW);

      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.SERVICE_OVERDUE]);
      expect(result.alerts[0].id).toBe(`service-overdue:${service.id}`);
    });

    it('prefers OVERDUE over DUE_TODAY when both could apply (more specific signal)', async () => {
      // A service that is overdue is, by construction, not in its current
      // due period — there's no overlap to worry about. But the use case
      // ALSO short-circuits the loop after pushing the overdue alert, so
      // even if a future-mode bug pushed both, this test would catch it.
      const overdue = buildMonthlyService({ startPeriod: '2026-01', lastPaidPeriod: '2026-02' });
      const { useCase } = buildUseCase({ services: [overdue] });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toHaveLength(1);
    });

    it('skips archived services', async () => {
      const archived = buildMonthlyService({
        startPeriod: '2026-05',
        isActive: false, // archived
      });
      const { useCase } = buildUseCase({ services: [archived] });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });
  });

  describe('habits-midday trigger', () => {
    it('emits HABITS_MIDDAY when post-noon AND at least one DAILY habit has no log today', async () => {
      const habit = buildHabit({ frequency: HabitFrequency.DAILY, name: 'Tomar agua' });
      const { useCase } = buildUseCase({ habits: [habit], habitLogs: [] });
      const result = await useCase.execute(USER_ID, TZ, NOW); // NOW = 12:00 Lima

      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.HABITS_MIDDAY]);
      expect(result.alerts[0].payload.firstHabitName).toBe('Tomar agua');
      expect(result.alerts[0].payload.missingCount).toBe(1);
    });

    it('suppresses HABITS_MIDDAY before noon in the user TZ (the gate)', async () => {
      const habit = buildHabit({ frequency: HabitFrequency.DAILY });
      const { useCase } = buildUseCase({ habits: [habit] });
      // 15:00 UTC = 10:00 Lima (pre-noon).
      const preNoon = new Date('2026-05-19T15:00:00.000Z');
      const result = await useCase.execute(USER_ID, TZ, preNoon);
      expect(result.alerts).toEqual([]);
    });

    it('does NOT emit HABITS_MIDDAY when every DAILY habit has a log today', async () => {
      const habit = buildHabit({ frequency: HabitFrequency.DAILY });
      const log = new HabitLog(
        'log-1',
        habit.id,
        USER_ID,
        '2026-05-19',
        1,
        true,
        null,
        new Date(),
        new Date(),
        1,
      );
      const { useCase } = buildUseCase({ habits: [habit], habitLogs: [log] });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });

    it('ignores WEEKLY habits when deciding whether to emit (only DAILY counts)', async () => {
      const weekly = buildHabit({ frequency: HabitFrequency.WEEKLY });
      const { useCase } = buildUseCase({ habits: [weekly] });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });
  });

  describe('budget-unlogged trigger', () => {
    // NOW = 2026-05-19 12:00 Lima → today (Lima) = 2026-05-19, period 2026-05.
    // Movements are stamped at 12:00 UTC (07:00 Lima) so the Lima calendar
    // day equals the date in the ISO string, keeping the streak math obvious.
    const movementOn = (budgetId: string, day: string, amount = 100): BudgetMovement =>
      buildBudgetMovement({
        budgetId,
        amount,
        currency: Currency.PEN,
        date: new Date(`2026-05-${day}T12:00:00.000Z`),
      });

    it('emits BUDGET_UNLOGGED when 2+ consecutive days end today with no movement', async () => {
      // Last movement on the 17th → 18th + 19th are silent → streak = 2.
      const budget = makeBudget({ year: 2026, month: 5, amount: 1000, currency: 'PEN' });
      const { useCase } = buildUseCase({
        budgets: [budget],
        budgetMovementsMap: new Map([[budget.id, [movementOn(budget.id, '17')]]]),
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.BUDGET_UNLOGGED]);
      expect(result.alerts[0].payload.days).toBe(2);
      expect(result.alerts[0].payload.remaining).toBe(900);
      expect(result.alerts[0].payload.currency).toBe('PEN');
    });

    it('does NOT emit when there is a movement today (streak resets to 0)', async () => {
      const budget = makeBudget({ year: 2026, month: 5, amount: 1000 });
      const { useCase } = buildUseCase({
        budgets: [budget],
        budgetMovementsMap: new Map([[budget.id, [movementOn(budget.id, '19')]]]),
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });

    it('does NOT emit when the gap is only 1 day (below the threshold)', async () => {
      // Movement yesterday (18th) → only today (19th) is silent → streak = 1.
      const budget = makeBudget({ year: 2026, month: 5, amount: 1000 });
      const { useCase } = buildUseCase({
        budgets: [budget],
        budgetMovementsMap: new Map([[budget.id, [movementOn(budget.id, '18')]]]),
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });

    it('does NOT emit when the budget has no money left (remaining <= 0)', async () => {
      // Fully spent early in the month, long silent gap after — but there's
      // nothing left to spend, so the "forgot to log" nudge makes no sense.
      const budget = makeBudget({ year: 2026, month: 5, amount: 1000 });
      const { useCase } = buildUseCase({
        budgets: [budget],
        budgetMovementsMap: new Map([[budget.id, [movementOn(budget.id, '05', 1000)]]]),
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });

    it('ignores budgets from other months (current-month gate)', async () => {
      // April budget with a silent gap — should NOT emit because we're in May.
      const aprilBudget = makeBudget({ year: 2026, month: 4, amount: 1000 });
      const { useCase } = buildUseCase({
        budgets: [aprilBudget],
        budgetMovementsMap: new Map([[aprilBudget.id, []]]),
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });

    /** A budget that WOULD emit, so each case below isolates only the hour. */
    function emittingBudget() {
      const budget = makeBudget({ year: 2026, month: 5, amount: 1000, currency: 'PEN' });
      return {
        budgets: [budget],
        budgetMovementsMap: new Map([[budget.id, [movementOn(budget.id, '17')]]]),
      };
    }

    it('suppresses the nudge early in the morning', async () => {
      // Firing at breakfast asks "did you forget to log?" before the user has
      // had a chance to spend anything — the nudge only reads as useful once
      // the day is genuinely under way.
      const { useCase } = buildUseCase(emittingBudget());
      // 2026-05-19 13:00 UTC = 08:00 Lima.
      const result = await useCase.execute(USER_ID, TZ, new Date('2026-05-19T13:00:00.000Z'));
      expect(result.alerts).toEqual([]);
    });

    it('still suppresses at 11:00 local, which used to be the boundary', async () => {
      // The gate shipped at 11 and moved to midday after real use — 11 was
      // still catching mornings where nothing had happened yet. This case
      // exists so a revert to 11 fails loudly instead of silently.
      const { useCase } = buildUseCase(emittingBudget());
      // 2026-05-19 16:00 UTC = 11:00 Lima exactly.
      const result = await useCase.execute(USER_ID, TZ, new Date('2026-05-19T16:00:00.000Z'));
      expect(result.alerts).toEqual([]);
    });

    it('emits exactly at 12:00 local (the boundary is inclusive)', async () => {
      const { useCase } = buildUseCase(emittingBudget());
      // 2026-05-19 17:00 UTC = 12:00 Lima exactly.
      const result = await useCase.execute(USER_ID, TZ, new Date('2026-05-19T17:00:00.000Z'));
      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.BUDGET_UNLOGGED]);
    });

    it('emits in the afternoon', async () => {
      const { useCase } = buildUseCase(emittingBudget());
      // 2026-05-19 21:00 UTC = 16:00 Lima.
      const result = await useCase.execute(USER_ID, TZ, new Date('2026-05-19T21:00:00.000Z'));
      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.BUDGET_UNLOGGED]);
    });
  });

  describe('chore-overdue trigger', () => {
    it('emits CHORE_OVERDUE for an active chore whose nextDueDate is before today', async () => {
      const chore = buildChore({ nextDueDate: '2026-05-15' });
      const { useCase } = buildUseCase({ chores: [chore] });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.CHORE_OVERDUE]);
      expect(result.alerts[0].payload.nextDueDate).toBe('2026-05-15');
    });

    it('skips an inactive chore', async () => {
      const chore = buildChore({ nextDueDate: '2026-05-15', isActive: false });
      const { useCase } = buildUseCase({ chores: [chore] });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });
  });

  describe('chore-due-today trigger', () => {
    it('emits CHORE_DUE_TODAY for an active chore due exactly today', async () => {
      // NOW = 2026-05-19 in Lima.
      const chore = buildChore({ nextDueDate: '2026-05-19', name: 'Regar las plantas' });
      const { useCase } = buildUseCase({ chores: [chore] });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.CHORE_DUE_TODAY]);
      expect(result.alerts[0].payload.choreName).toBe('Regar las plantas');
      expect(result.alerts[0].payload.nextDueDate).toBe('2026-05-19');
    });

    it('is dismissable, unlike chore-overdue', () => {
      // Per-day: "I know, I will do it later today" is a reasonable answer, and
      // it comes back tomorrow as an overdue if they do not. Overdue stays
      // persistent because there is no later left.
      expect(isDismissable(AlertType.CHORE_DUE_TODAY)).toBe(true);
      expect(isDismissable(AlertType.CHORE_OVERDUE)).toBe(false);
    });

    it('does NOT emit for a chore due tomorrow', async () => {
      const chore = buildChore({ nextDueDate: '2026-05-20' });
      const { useCase } = buildUseCase({ chores: [chore] });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });

    it('skips an inactive chore due today', async () => {
      const chore = buildChore({ nextDueDate: '2026-05-19', isActive: false });
      const { useCase } = buildUseCase({ chores: [chore] });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });

    it('emits at most one chore alert per chore — overdue and due-today are exclusive', async () => {
      const overdue = buildChore({ nextDueDate: '2026-05-15' });
      const dueToday = buildChore({ nextDueDate: '2026-05-19' });
      const { useCase } = buildUseCase({ chores: [overdue, dueToday] });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts.map((a) => a.type).sort()).toEqual([
        AlertType.CHORE_DUE_TODAY,
        AlertType.CHORE_OVERDUE,
      ]);
    });

    it('fires regardless of the hour, unlike the budget nudge', async () => {
      // No hour gate: the alert lives in the bell popover, so the user only
      // ever sees it when they open the app themselves.
      const chore = buildChore({ nextDueDate: '2026-05-19' });
      const { useCase } = buildUseCase({ chores: [chore] });
      // 06:00 Lima.
      const earlyMorning = new Date('2026-05-19T11:00:00.000Z');
      const result = await useCase.execute(USER_ID, TZ, earlyMorning);
      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.CHORE_DUE_TODAY]);
    });
  });

  describe('dismiss filtering', () => {
    it('filters out alerts whose ID has an active dismissal', async () => {
      const service = buildMonthlyService({
        startPeriod: '2026-05',
        lastPaidPeriod: null,
        dueDay: 19,
      });
      const dismissed = new UserAlertDismissal(
        'dismiss-1',
        USER_ID,
        `service-due-today:${service.id}:2026-05`,
        new Date('2026-05-19T16:00:00.000Z'),
        // Expires AFTER NOW — still active.
        new Date('2026-05-20T05:00:00.000Z'),
      );
      const { useCase } = buildUseCase({
        services: [service],
        dismissals: [dismissed],
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });

    it('keeps alerts whose dismissal has already expired (the row is stale)', async () => {
      const service = buildMonthlyService({
        startPeriod: '2026-05',
        lastPaidPeriod: null,
        dueDay: 19,
      });
      const stale = new UserAlertDismissal(
        'dismiss-1',
        USER_ID,
        `service-due-today:${service.id}:2026-05`,
        new Date('2026-05-18T16:00:00.000Z'),
        new Date('2026-05-19T05:00:00.000Z'), // already expired wrt NOW
      );
      const { useCase } = buildUseCase({
        services: [service],
        dismissals: [stale],
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toHaveLength(1);
    });
  });

  it('returns lastSeenAt from user_settings to drive the bell badge', async () => {
    const seenAt = new Date('2026-05-18T20:00:00.000Z');
    const { useCase } = buildUseCase({ lastAlertsSeenAt: seenAt });
    const result = await useCase.execute(USER_ID, TZ, NOW);
    expect(result.lastSeenAt).toEqual(seenAt);
  });

  describe('budget-unlogged across a day boundary', () => {
    // The reported doubt: "I close the nudge, the next day I still haven't
    // logged anything, and it never comes back."
    //
    // Two independent mechanisms are supposed to make it return, and this
    // block pins both — if either regressed, the alert would go quiet for good
    // and nothing else in the suite would notice.
    //
    //   1. The alert ID embeds the DATE, so tomorrow's alert is a different
    //      row that no dismissal has ever matched.
    //   2. The dismissal itself expires at the user's local midnight.
    //
    // NOW is 2026-05-19 12:00 Lima; TOMORROW is the same clock time a day on.
    const TOMORROW = new Date('2026-05-20T17:00:00.000Z');

    /** A budget with money left and no movements since the 17th. */
    function silentBudget() {
      const budget = makeBudget({ year: 2026, month: 5, amount: 1000, currency: 'PEN' });
      const movements = new Map([
        [
          budget.id,
          [
            buildBudgetMovement({
              budgetId: budget.id,
              amount: 100,
              currency: Currency.PEN,
              date: new Date('2026-05-17T12:00:00.000Z'),
            }),
          ],
        ],
      ]);
      return { budget, movements };
    }

    /** The dismissal the user creates by closing today's nudge. */
    function dismissalFor(budgetId: string, date: string, expiresAt: Date) {
      return new UserAlertDismissal(
        'dismiss-budget',
        USER_ID,
        `budget-unlogged:${budgetId}:${date}`,
        new Date('2026-05-19T17:05:00.000Z'),
        expiresAt,
      );
    }

    it('hides the nudge for the rest of the day it was closed', async () => {
      const { budget, movements } = silentBudget();
      const { useCase } = buildUseCase({
        budgets: [budget],
        budgetMovementsMap: movements,
        // Expires at Lima midnight, which is 05:00 UTC on the 20th.
        dismissals: [dismissalFor(budget.id, '2026-05-19', new Date('2026-05-20T05:00:00.000Z'))],
      });

      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });

    it('brings it back the next day when the budget is still silent', async () => {
      const { budget, movements } = silentBudget();
      const { useCase } = buildUseCase({
        budgets: [budget],
        budgetMovementsMap: movements,
        dismissals: [dismissalFor(budget.id, '2026-05-19', new Date('2026-05-20T05:00:00.000Z'))],
      });

      const result = await useCase.execute(USER_ID, TZ, TOMORROW);

      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.BUDGET_UNLOGGED]);
      // A fresh ID for a fresh day — this is mechanism 1.
      expect(result.alerts[0].id).toBe(`budget-unlogged:${budget.id}:2026-05-20`);
      // And the streak has grown, so the copy reflects the longer silence.
      expect(result.alerts[0].payload.days).toBe(3);
    });

    it('comes back even if the dismissal row somehow never expired', async () => {
      // Belt and braces for mechanism 1 on its own: a dismissal with NO expiry
      // at all (`expiresAt: null` is treated as permanently active) still only
      // covers the day it names.
      const { budget, movements } = silentBudget();
      const neverExpires = new UserAlertDismissal(
        'dismiss-budget',
        USER_ID,
        `budget-unlogged:${budget.id}:2026-05-19`,
        new Date('2026-05-19T17:05:00.000Z'),
        null,
      );
      const { useCase } = buildUseCase({
        budgets: [budget],
        budgetMovementsMap: movements,
        dismissals: [neverExpires],
      });

      const result = await useCase.execute(USER_ID, TZ, TOMORROW);
      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.BUDGET_UNLOGGED]);
    });

    it('stays hidden the next day only if the user actually logged something', async () => {
      // The honest alternative explanation for "it never came back": the
      // streak reset because a movement landed. Pinning it so the two causes
      // stay distinguishable.
      const budget = makeBudget({ year: 2026, month: 5, amount: 1000, currency: 'PEN' });
      const { useCase } = buildUseCase({
        budgets: [budget],
        budgetMovementsMap: new Map([
          [
            budget.id,
            [
              buildBudgetMovement({
                budgetId: budget.id,
                amount: 100,
                currency: Currency.PEN,
                date: new Date('2026-05-20T12:00:00.000Z'),
              }),
            ],
          ],
        ]),
      });

      const result = await useCase.execute(USER_ID, TZ, TOMORROW);
      expect(result.alerts).toEqual([]);
    });
  });
});
