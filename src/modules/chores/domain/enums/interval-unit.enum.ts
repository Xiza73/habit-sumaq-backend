/**
 * Cadence unit for a chore's recurrence. Persisted as VARCHAR with a CHECK
 * constraint at the DB level (NOT a Postgres ENUM type). The string values
 * match the column values 1:1 — DO NOT change them without a migration.
 */
export enum IntervalUnit {
  DAYS = 'days',
  WEEKS = 'weeks',
  MONTHS = 'months',
  YEARS = 'years',
}
