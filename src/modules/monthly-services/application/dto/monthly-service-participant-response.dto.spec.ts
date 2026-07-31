import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';

import { MonthlyServiceParticipantResponseDto } from './monthly-service-participant-response.dto';

describe('MonthlyServiceParticipantResponseDto.fromDomain', () => {
  function buildParticipant(): MonthlyServiceParticipant {
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
    });
  }

  it('exposes exactly the intended allowlist of fields', () => {
    const dto = MonthlyServiceParticipantResponseDto.fromDomain(buildParticipant());

    expect(Object.keys(dto).sort()).toEqual(
      [
        'id',
        'monthlyServiceId',
        'userId',
        'reference',
        'defaultAmount',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
  });

  it('never leaks internal-only entity fields', () => {
    const dto = MonthlyServiceParticipantResponseDto.fromDomain(buildParticipant());
    const keys = Object.keys(dto);

    expect(keys).not.toContain('normalizedReference');
    expect(keys).not.toContain('deletedAt');
  });
});
