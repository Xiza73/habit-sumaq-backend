export const ERROR_CODES = {
  // Categories
  CATEGORY_NOT_FOUND: 'CAT_001',
  CATEGORY_NAME_TAKEN: 'CAT_002',
  CATEGORY_BELONGS_TO_OTHER_USER: 'CAT_003',
  CANNOT_DELETE_DEFAULT_CATEGORY: 'CAT_004',
  // Accounts
  ACCOUNT_NOT_FOUND: 'ACC_001',
  ACCOUNT_NAME_TAKEN: 'ACC_002',
  ACCOUNT_HAS_ACTIVE_TRANSACTIONS: 'ACC_003',
  ACCOUNT_BELONGS_TO_OTHER_USER: 'ACC_004',
  CANNOT_CHANGE_CURRENCY_WITH_TX: 'ACC_005',
  // Users
  USER_NOT_FOUND: 'USR_001',
  USER_INACTIVE: 'USR_002',
  // Auth
  INVALID_REFRESH_TOKEN: 'AUT_001',
  // Domain value objects
  INVALID_MONEY_AMOUNT: 'VAL_001',
  CURRENCY_MISMATCH: 'VAL_002',
  // Transactions
  TRANSACTION_NOT_FOUND: 'TXN_001',
  TRANSACTION_BELONGS_TO_OTHER_USER: 'TXN_002',
  INSUFFICIENT_BALANCE: 'TXN_003',
  TRANSFER_SAME_ACCOUNT: 'TXN_004',
  TRANSFER_CURRENCY_MISMATCH: 'TXN_005',
  DESTINATION_ACCOUNT_NOT_FOUND: 'TXN_006',
  TRANSFER_DESTINATION_REQUIRED: 'TXN_007',
  REFERENCE_REQUIRED: 'TXN_008',
  TRANSACTION_NOT_DEBT_OR_LOAN: 'TXN_009',
  TRANSACTION_ALREADY_SETTLED: 'TXN_010',
  CANNOT_UPDATE_SETTLED_TRANSACTION: 'TXN_011',
  SETTLEMENT_AMOUNT_EXCEEDS_REMAINING: 'TXN_012',
  AMOUNT_BELOW_SETTLED: 'TXN_013',
  // Habits
  HABIT_NOT_FOUND: 'HAB_001',
  HABIT_NAME_TAKEN: 'HAB_002',
  HABIT_ARCHIVED: 'HAB_003',
  HABIT_LOG_FUTURE_DATE: 'HAB_004',
  INVALID_TARGET_COUNT: 'HAB_005',
  HABIT_BELONGS_TO_OTHER_USER: 'HAB_006',
  // Quick tasks (daily TODOs)
  QUICK_TASK_NOT_FOUND: 'QTK_001',
  QUICK_TASK_BELONGS_TO_OTHER_USER: 'QTK_002',
  QUICK_TASK_TITLE_REQUIRED: 'QTK_003',
  QUICK_TASK_TITLE_TOO_LONG: 'QTK_004',
  QUICK_TASK_DESCRIPTION_TOO_LONG: 'QTK_005',
  QUICK_TASK_REORDER_INVALID_IDS: 'QTK_006',
  // Monthly services
  MONTHLY_SERVICE_HAS_PAYMENTS: 'MSVC_001',
  MONTHLY_SERVICE_NOT_FOUND: 'MSVC_002',
  MONTHLY_SERVICE_NAME_TAKEN: 'MSVC_003',
  MONTHLY_SERVICE_ALREADY_PAID: 'MSVC_004',
  // Chores (recurring household tasks)
  CHORE_HAS_LOGS: 'CHRE_001',
  CHORE_NOT_FOUND: 'CHRE_002',
  // Budgets (monthly discretionary spending)
  BUDGET_NOT_FOUND: 'BDGT_001',
  BUDGET_ALREADY_EXISTS: 'BDGT_002',
  MOVEMENT_DATE_OUT_OF_RANGE: 'BDGT_003',
  // Tasks + Sections (project-style TODOs with weekly cleanup)
  SECTION_NOT_FOUND: 'TSK_001',
  SECTION_NAME_REQUIRED: 'TSK_002',
  SECTION_NAME_TOO_LONG: 'TSK_003',
  SECTION_REORDER_INVALID_IDS: 'TSK_004',
  TASK_NOT_FOUND: 'TSK_005',
  TASK_TITLE_REQUIRED: 'TSK_006',
  TASK_TITLE_TOO_LONG: 'TSK_007',
  TASK_DESCRIPTION_TOO_LONG: 'TSK_008',
  TASK_REORDER_INVALID_IDS: 'TSK_009',
  // Alerts (in-app pseudo-notifications)
  ALERT_NOT_DISMISSABLE: 'ALR_001',
  // Debts and Loans module (v1.0.0 standalone module — replaces the
  // DEBT/LOAN subset of transactions).
  DEBT_LOAN_NOT_FOUND: 'DBT_001',
  DEBT_LOAN_BELONGS_TO_OTHER_USER: 'DBT_002',
  DEBT_LOAN_REFERENCE_REQUIRED: 'DBT_003',
  DEBT_LOAN_ALREADY_SETTLED: 'DBT_004',
  CANNOT_UPDATE_SETTLED_DEBT_LOAN: 'DBT_005',
  DEBT_LOAN_SETTLEMENT_EXCEEDS_REMAINING: 'DBT_006',
  DEBT_LOAN_AMOUNT_BELOW_SETTLED: 'DBT_007',
  // Phase 2 — payment history edit/delete.
  DEBT_LOAN_PAYMENT_NOT_FOUND: 'DBT_008',
  DEBT_LOAN_PAYMENT_UPDATE_NO_FIELDS: 'DBT_009',
  DEBT_LOAN_PAYMENT_EXCEEDS_DEBT_AMOUNT: 'DBT_010',
  // Amount-based FIFO settle across a person's obligations of one direction
  // (POST /debts/settle-amount-by-reference). Thrown when no PENDING rows
  // match the (normalized reference, currency, type) group.
  DEBT_LOAN_NO_PENDING_FOR_REFERENCE: 'DBT_011',
  // Budget movements module (v1.0.0 standalone module — replaces the
  // EXPENSE subset of legacy transactions where `budgetId IS NOT NULL`).
  BUDGET_MOVEMENT_NOT_FOUND: 'BMV_001',
  BUDGET_MOVEMENT_BELONGS_TO_OTHER_USER: 'BMV_002',
  BUDGET_MOVEMENT_DATE_OUT_OF_BUDGET_RANGE: 'BMV_003',
  BUDGET_MOVEMENT_CURRENCY_MISMATCH: 'BMV_004',
  // Monthly service payments module (v1.0.0 standalone module —
  // replaces the EXPENSE subset of legacy transactions where
  // `monthlyServiceId IS NOT NULL`).
  MONTHLY_SERVICE_PAYMENT_NOT_FOUND: 'MSP_001',
  MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER: 'MSP_002',
  MONTHLY_SERVICE_PAYMENT_ALREADY_EXISTS_FOR_PERIOD: 'MSP_003',
  MONTHLY_SERVICE_PAYMENT_CURRENCY_MISMATCH: 'MSP_004',
  MONTHLY_SERVICE_PAYMENT_INVALID_PERIOD_FORMAT: 'MSP_005',
  // Shared-service participant config (v2 — participants CRUD, slice 1 of
  // the shared-payment-services feature. Payment generation / linked debts
  // land in a later slice).
  // Reserved: no longer thrown after the single-participant endpoints were
  // removed in the batch-replace rework. Kept for `Record<ErrorCodeKey, number>`
  // exhaustiveness (removing it would be a breaking code-space change).
  // TODO (cleanup): drop if a future major release renumbers the MSP space.
  MSP_PARTICIPANT_NOT_FOUND: 'MSP_006',
  MSP_PARTICIPANT_DUPLICATE_REFERENCE: 'MSP_007',
  MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED: 'MSP_008',
  MSP_PARTICIPANT_AMOUNT_NOT_POSITIVE: 'MSP_009',
  // Shared-payment slice 2: pay-with-splits.
  MSP_SPLIT_EXCEEDS_TOTAL: 'MSP_010',
  // Currency pools (internal-only — v1.0.0 refactor).
  // Migration-time only: thrown by `BackfillCurrencyPools` and the
  // `check-balance-consistency` audit script when `accounts.balance`
  // diverges from the replayed transaction history. Never returned
  // over HTTP — not in `domain-error.map.ts`.
  BALANCE_DRIFT_DETECTED: 'POOL_001',
  // Validation
  VALIDATION_ERROR: 'GEN_001',
} as const;

export type ErrorCodeKey = keyof typeof ERROR_CODES;
