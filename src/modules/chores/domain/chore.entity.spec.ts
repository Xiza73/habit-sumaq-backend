import { buildChore } from './__tests__/chore.factory';
import { IntervalUnit } from './enums/interval-unit.enum';

describe('Chore.revertLastDone', () => {
  it('reconstructs lastDoneDate and nextDueDate from the previous log doneAt', () => {
    const chore = buildChore({
      intervalValue: 2,
      intervalUnit: IntervalUnit.WEEKS,
      startDate: '2026-04-01',
      lastDoneDate: '2026-04-15',
      nextDueDate: '2026-04-29',
    });

    chore.revertLastDone('2026-04-01');

    expect(chore.lastDoneDate).toBe('2026-04-01');
    // 2 weeks from 2026-04-01 = 2026-04-15
    expect(chore.nextDueDate).toBe('2026-04-15');
  });

  it('falls back to null lastDoneDate and startDate nextDueDate when no logs remain', () => {
    const chore = buildChore({
      intervalValue: 2,
      intervalUnit: IntervalUnit.WEEKS,
      startDate: '2026-04-01',
      lastDoneDate: '2026-04-15',
      nextDueDate: '2026-04-29',
    });

    chore.revertLastDone(null);

    expect(chore.lastDoneDate).toBeNull();
    expect(chore.nextDueDate).toBe('2026-04-01');
  });

  it('bumps updatedAt', () => {
    const chore = buildChore({ updatedAt: new Date('2020-01-01T00:00:00Z') });

    chore.revertLastDone(null);

    expect(chore.updatedAt.getTime()).toBeGreaterThan(new Date('2020-01-01T00:00:00Z').getTime());
  });
});
