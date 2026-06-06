/**
 * Balance-consistency audit logic. Single source of truth shared by:
 *
 *  - The standalone CLI (`check-balance-consistency.ts`, `pnpm migration:audit-balance`)
 *    that the user runs BEFORE merging A1-B.2 to master, so they can
 *    review any drift in production data manually.
 *
 *  - The `BackfillCurrencyPools` migration itself, which runs the same
 *    audit at startup and throws `POOL_001` on drift — defense in depth
 *    against a manual review that missed something.
 *
 * The audit computes, per `(userId, accountId, currency)`, the EXPECTED
 * balance by replaying every non-deleted transaction's signed effect on
 * `accounts.balance`, and compares it to the actual `accounts.balance`.
 *
 * Per the existing `transactions` module semantics:
 *
 *  - `INCOME` on accountId credits the balance
 *  - `EXPENSE` on accountId debits it
 *  - `TRANSFER` debits the source `accountId` and credits `destinationAccountId`
 *  - `DEBT` / `LOAN` create a row but DO NOT touch the balance — settlements
 *    (which are EXPENSE/INCOME rows with `relatedTransactionId`) are what
 *    actually move money, and those are already counted by the EXPENSE/INCOME
 *    branches above.
 *
 * A "drift" of > 0.5¢ means `accounts.balance` does not match the running
 * total of its transaction history — either the account had a non-zero
 * initial balance at creation (which the user knows about and can confirm),
 * or there's a historical bug that the backfill would silently consagrate
 * into the currency pool forever. Either way: STOP and review before A1-B.2
 * merges.
 *
 * NOTE: this audit treats "initial balance" as drift. Single-user-prod
 * convention is that the user reviews the drift report and either:
 *   (a) confirms each non-zero diff matches their known initial balance →
 *       proceeds with the migration manually (no automated bypass);
 *   (b) sees an unexpected diff and investigates before continuing.
 *
 * The migration itself does NOT have an "override" flag — bypassing requires
 * manually editing/short-circuiting the migration, which is intentional
 * friction for a point-of-no-return decision.
 */

/**
 * Tolerance for floating-point comparisons. NUMERIC(14,2) means the smallest
 * unit is 0.01 (one cent). We use half a cent as the threshold so that
 * benign 0.00...001 representation noise doesn't flag drift, but a real 1¢
 * difference does.
 */
export const DRIFT_TOLERANCE = 0.005;

/**
 * Single-statement audit. Returns one row per active account with its
 * `(actual, expected, diff)` triple. The caller filters for drift using
 * the helper `summarizeAuditResult`.
 *
 * Computes `expected` by aggregating signed contributions across the
 * transaction history in one pass. The `LEFT JOIN` ensures accounts with
 * zero transactions still appear (they expect 0, and `actual` should
 * match unless an initial balance was set).
 */
export const BALANCE_AUDIT_SQL = `
  SELECT
    a.id AS "accountId",
    a."userId" AS "userId",
    a.currency AS currency,
    a.balance::numeric(14,2) AS actual,
    COALESCE(
      SUM(
        CASE
          WHEN t."accountId" = a.id AND t.type = 'INCOME'   THEN  t.amount
          WHEN t."accountId" = a.id AND t.type = 'EXPENSE'  THEN -t.amount
          WHEN t."accountId" = a.id AND t.type = 'TRANSFER' THEN -t.amount
          WHEN t."destinationAccountId" = a.id AND t.type = 'TRANSFER' THEN t.amount
          ELSE 0
        END
      ),
      0
    )::numeric(14,2) AS expected,
    (
      a.balance - COALESCE(
        SUM(
          CASE
            WHEN t."accountId" = a.id AND t.type = 'INCOME'   THEN  t.amount
            WHEN t."accountId" = a.id AND t.type = 'EXPENSE'  THEN -t.amount
            WHEN t."accountId" = a.id AND t.type = 'TRANSFER' THEN -t.amount
            WHEN t."destinationAccountId" = a.id AND t.type = 'TRANSFER' THEN t.amount
            ELSE 0
          END
        ),
        0
      )
    )::numeric(14,2) AS diff
  FROM accounts a
  LEFT JOIN transactions t
    ON (t."accountId" = a.id OR t."destinationAccountId" = a.id)
   AND t."deletedAt" IS NULL
  WHERE a."deletedAt" IS NULL
  GROUP BY a.id, a."userId", a.currency, a.balance
  ORDER BY ABS(a.balance - COALESCE(
    SUM(
      CASE
        WHEN t."accountId" = a.id AND t.type = 'INCOME'   THEN  t.amount
        WHEN t."accountId" = a.id AND t.type = 'EXPENSE'  THEN -t.amount
        WHEN t."accountId" = a.id AND t.type = 'TRANSFER' THEN -t.amount
        WHEN t."destinationAccountId" = a.id AND t.type = 'TRANSFER' THEN t.amount
        ELSE 0
      END
    ),
    0
  )) DESC
`;

/** One row of the audit query. Postgres returns NUMERIC as `string`. */
export interface AuditRow {
  accountId: string;
  userId: string;
  currency: string;
  actual: string;
  expected: string;
  diff: string;
}

/**
 * Aggregated audit result. `drifts` is the subset of rows where |diff|
 * exceeds `DRIFT_TOLERANCE`. `status` is `CLEAN` iff `drifts` is empty.
 */
export interface AuditResult {
  status: 'CLEAN' | 'DRIFT_DETECTED';
  totalAccounts: number;
  totalDriftRows: number;
  drifts: AuditRow[];
}

/**
 * Pure function: given the raw query rows, classify them and produce the
 * structured result. Unit-testable without a DB.
 */
export function summarizeAuditResult(rows: AuditRow[]): AuditResult {
  const drifts = rows.filter((r) => Math.abs(Number(r.diff)) > DRIFT_TOLERANCE);
  return {
    status: drifts.length === 0 ? 'CLEAN' : 'DRIFT_DETECTED',
    totalAccounts: rows.length,
    totalDriftRows: drifts.length,
    drifts,
  };
}
