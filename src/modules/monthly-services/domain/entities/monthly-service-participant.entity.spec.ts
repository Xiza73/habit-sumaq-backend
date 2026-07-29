import { MonthlyServiceParticipant } from './monthly-service-participant.entity';

function buildParticipant(
  overrides: Partial<ConstructorParameters<typeof MonthlyServiceParticipant>[0]> = {},
) {
  const now = new Date('2026-07-27T12:00:00.000Z');
  return new MonthlyServiceParticipant({
    id: 'participant-1',
    monthlyServiceId: 'service-1',
    userId: 'user-1',
    reference: 'Ana',
    normalizedReference: 'ana',
    defaultAmount: 100,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });
}

describe('MonthlyServiceParticipant', () => {
  it('constructs with valid fields', () => {
    const participant = buildParticipant();

    expect(participant.reference).toBe('Ana');
    expect(participant.normalizedReference).toBe('ana');
    expect(participant.defaultAmount).toBe(100);
  });

  it('rejects a non-positive defaultAmount at construction (zero)', () => {
    expect(() => buildParticipant({ defaultAmount: 0 })).toThrow(
      'El monto por defecto debe ser mayor a 0',
    );
  });

  it('rejects a negative defaultAmount at construction', () => {
    expect(() => buildParticipant({ defaultAmount: -10 })).toThrow(
      'El monto por defecto debe ser mayor a 0',
    );
  });

  it('isDeleted() reflects deletedAt', () => {
    expect(buildParticipant({ deletedAt: null }).isDeleted()).toBe(false);
    expect(buildParticipant({ deletedAt: new Date() }).isDeleted()).toBe(true);
  });

  it('updateDefaultAmount() replaces the amount and bumps updatedAt', () => {
    const participant = buildParticipant({ defaultAmount: 100 });
    const before = participant.updatedAt;

    participant.updateDefaultAmount(120);

    expect(participant.defaultAmount).toBe(120);
    expect(participant.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('updateDefaultAmount() rejects a non-positive amount', () => {
    const participant = buildParticipant({ defaultAmount: 100 });

    expect(() => participant.updateDefaultAmount(0)).toThrow(
      'El monto por defecto debe ser mayor a 0',
    );
    expect(participant.defaultAmount).toBe(100);
  });
});
