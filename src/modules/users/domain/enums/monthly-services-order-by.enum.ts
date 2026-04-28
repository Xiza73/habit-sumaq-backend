/**
 * How the user wants their monthly-services list sorted on the web. Persisted
 * as a per-user preference via `user_settings`.
 */
export enum MonthlyServicesOrderBy {
  NAME = 'name',
  DUE_DAY = 'dueDay',
  NEXT_DUE_PERIOD = 'nextDuePeriod',
  ESTIMATED_AMOUNT = 'estimatedAmount',
  CREATED_AT = 'createdAt',
}
