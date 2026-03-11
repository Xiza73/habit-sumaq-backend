import { createHash } from 'node:crypto';

function h(code: string): string {
  return createHash('sha256').update(code).digest('hex').slice(0, 8);
}

export const ERROR_CODES = {
  // Accounts
  ACCOUNT_NOT_FOUND: h('ACCOUNT_NOT_FOUND'),
  ACCOUNT_NAME_TAKEN: h('ACCOUNT_NAME_TAKEN'),
  ACCOUNT_HAS_ACTIVE_TRANSACTIONS: h('ACCOUNT_HAS_ACTIVE_TRANSACTIONS'),
  ACCOUNT_BELONGS_TO_OTHER_USER: h('ACCOUNT_BELONGS_TO_OTHER_USER'),
  CANNOT_CHANGE_CURRENCY_WITH_TX: h('CANNOT_CHANGE_CURRENCY_WITH_TX'),
  // Users
  USER_NOT_FOUND: h('USER_NOT_FOUND'),
  USER_INACTIVE: h('USER_INACTIVE'),
  // Auth
  INVALID_REFRESH_TOKEN: h('INVALID_REFRESH_TOKEN'),
  // Domain value objects
  INVALID_MONEY_AMOUNT: h('INVALID_MONEY_AMOUNT'),
  CURRENCY_MISMATCH: h('CURRENCY_MISMATCH'),
  // Validation
  VALIDATION_ERROR: h('VALIDATION_ERROR'),
} as const;

export type ErrorCodeKey = keyof typeof ERROR_CODES;
