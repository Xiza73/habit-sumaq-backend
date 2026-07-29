import { QueryFailedError } from 'typeorm';

import { isUniqueViolation, PG_UNIQUE_VIOLATION } from './postgres-error';

describe('isUniqueViolation', () => {
  it('detects a 23505 on driverError.code', () => {
    const driverError = Object.assign(new Error('duplicate key'), {
      code: PG_UNIQUE_VIOLATION,
    });
    const error = new QueryFailedError('INSERT ...', [], driverError);

    expect(isUniqueViolation(error)).toBe(true);
  });

  it('detects a 23505 copied onto the top-level error code', () => {
    const error = new QueryFailedError('INSERT ...', [], new Error('duplicate key'));
    (error as unknown as { code: string }).code = PG_UNIQUE_VIOLATION;

    expect(isUniqueViolation(error)).toBe(true);
  });

  it('ignores QueryFailedError with a different SQLSTATE', () => {
    const driverError = Object.assign(new Error('not null'), { code: '23502' });
    const error = new QueryFailedError('INSERT ...', [], driverError);

    expect(isUniqueViolation(error)).toBe(false);
  });

  it('ignores non-QueryFailedError values', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation({ code: PG_UNIQUE_VIOLATION })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
