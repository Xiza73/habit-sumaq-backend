/**
 * How the user wants their monthly-services list grouped on the web. Persisted
 * as a per-user preference via `user_settings`.
 */
export enum MonthlyServicesGroupBy {
  NONE = 'none',
  STATUS = 'status',
  FREQUENCY = 'frequency',
  CATEGORY = 'category',
}
