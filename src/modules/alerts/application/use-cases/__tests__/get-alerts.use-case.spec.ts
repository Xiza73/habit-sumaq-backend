import { makeBudget } from '@modules/budgets/domain/__tests__/budget.factory';
import { buildChore } from '@modules/chores/domain/__tests__/chore.factory';
import { buildHabit } from '@modules/habits/domain/__tests__/habit.factory';
import { HabitFrequency } from '@modules/habits/domain/enums/habit-frequency.enum';
import { HabitLog } from '@modules/habits/domain/habit-log.entity';
import { buildMonthlyService } from '@modules/monthly-services/domain/__tests__/monthly-service.factory';
import { buildUserSettings } from '@modules/users/domain/__tests__/user-settings.factory';

import { AlertType } from '../../../domain/enums/alert-type.enum';
import { UserAlertDismissal } from '../../../domain/user-alert-dismissal.entity';
import { GetAlertsForUserUseCase } from '../get-alerts.use-case';

import type { UserAlertDismissalRepository } from '../../../domain/user-alert-dismissal.repository';
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
    budgetSpentMap: Map<string, number>;
    chores: ReturnType<typeof buildChore>[];
    dismissals: UserAlertDismissal[];
    lastAlertsSeenAt: Date | null;
  }>,
): { useCase: GetAlertsForUserUseCase; spies: Record<string, jest.Mock> } {
  const services = overrides.services ?? [];
  const habits = overrides.habits ?? [];
  const habitLogs = overrides.habitLogs ?? [];
  const budgets = overrides.budgets ?? [];
  const budgetSpentMap = overrides.budgetSpentMap ?? new Map<string, number>();
  const chores = overrides.chores ?? [];
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
    findCompletedByHabitIdSince: jest.fn(),
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

  // v1.0.0: budget overspent alert sums movements from the new
  // `budget_movements` table, not legacy `transactions`.
  const budgetMovementRepo = {
    sumByBudgetId: jest.fn((id: string) => Promise.resolve(budgetSpentMap.get(id) ?? 0)),
  } as unknown as BudgetMovementRepository;

  const choresRepo: jest.Mocked<ChoreRepository> = {
    findByUserId: jest.fn().mockResolvedValue(chores),
    findById: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
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
      // Due on the 29th, but today (Lima) is the 19th → not due yet. The alert
      // must not fire until the actual due day.
      const service = buildMonthlyService({
        startPeriod: '2026-05',
        lastPaidPeriod: null,
        dueDay: 29,
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

  describe('budget-overspent trigger', () => {
    it('emits BUDGET_OVERSPENT when a current-month budget has spent > amount', async () => {
      const budget = makeBudget({ year: 2026, month: 5, amount: 1000, currency: 'PEN' });
      const { useCase } = buildUseCase({
        budgets: [budget],
        budgetSpentMap: new Map([[budget.id, 1500]]),
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts.map((a) => a.type)).toEqual([AlertType.BUDGET_OVERSPENT]);
      expect(result.alerts[0].payload.remaining).toBe(-500);
    });

    it('does NOT emit for a budget that is on track (spent <= amount)', async () => {
      const budget = makeBudget({ year: 2026, month: 5, amount: 1000 });
      const { useCase } = buildUseCase({
        budgets: [budget],
        budgetSpentMap: new Map([[budget.id, 600]]),
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
    });

    it('ignores budgets from other months (current-month gate)', async () => {
      // April budget overspent — should NOT emit because we're in May now.
      const aprilBudget = makeBudget({ year: 2026, month: 4, amount: 1000 });
      const { useCase } = buildUseCase({
        budgets: [aprilBudget],
        budgetSpentMap: new Map([[aprilBudget.id, 9999]]),
      });
      const result = await useCase.execute(USER_ID, TZ, NOW);
      expect(result.alerts).toEqual([]);
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
});
