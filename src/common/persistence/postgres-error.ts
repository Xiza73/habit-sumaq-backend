import { QueryFailedError } from 'typeorm';

/** Postgres SQLSTATE for a unique-constraint violation. */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * True when `error` is a TypeORM `QueryFailedError` caused by a Postgres
 * unique-constraint violation (SQLSTATE 23505).
 *
 * The `pg` driver exposes the SQLSTATE on `driverError.code`, and TypeORM
 * historically copies it onto the error itself too, so both are checked.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverCode = (error.driverError as { code?: string } | undefined)?.code;
  const topLevelCode = (error as unknown as { code?: string }).code;
  return driverCode === PG_UNIQUE_VIOLATION || topLevelCode === PG_UNIQUE_VIOLATION;
}
