/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
import { AppDataSource } from '../data-source';

import { type AuditRow, BALANCE_AUDIT_SQL, summarizeAuditResult } from './balance-audit';

/**
 * Standalone audit CLI for the v1.0.0 `accounts-to-modular-finance`
 * refactor. Computes per-`(userId, accountId, currency)` drift between
 * the current `accounts.balance` and the value implied by replaying every
 * non-deleted transaction's signed effect.
 *
 * Use case: the user runs this BEFORE merging A1-B.2 (which contains the
 * `BackfillCurrencyPools` migration) to staging or master, to surface any
 * historical drift that would otherwise be silently consagrated into the
 * `currency_pools` table.
 *
 * Output: JSON to stdout, schema per `summarizeAuditResult`.
 *
 *   {
 *     "status": "CLEAN" | "DRIFT_DETECTED",
 *     "totalAccounts": N,
 *     "totalDriftRows": N,
 *     "drifts": [ { accountId, userId, currency, actual, expected, diff } ]
 *   }
 *
 * Exit codes:
 *   - 0 → CLEAN (no drift over 0.5¢)
 *   - 1 → DRIFT_DETECTED (at least one account drifts)
 *   - 2 → script failed unexpectedly (DB connection, SQL error, etc.)
 *
 * Run with: `pnpm migration:audit-balance`
 */
async function checkBalanceConsistency() {
  await AppDataSource.initialize();

  try {
    const rows: AuditRow[] = await AppDataSource.query(BALANCE_AUDIT_SQL);
    const result = summarizeAuditResult(rows);

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

    if (result.status === 'DRIFT_DETECTED') {
      console.error(
        `\n[POOL_001] BALANCE_DRIFT_DETECTED — ${result.totalDriftRows} of ` +
          `${result.totalAccounts} active account(s) have balance mismatching the ` +
          `transaction history. Review each drift row above: confirm it matches an ` +
          `initial balance you set at account creation, or investigate before ` +
          `running the BackfillCurrencyPools migration.`,
      );
      process.exit(1);
    }

    console.error(
      `\n✅ Balance audit CLEAN — ${result.totalAccounts} account(s) reconcile with ` +
        `their transaction history within ±0.5¢ tolerance.`,
    );
    process.exit(0);
  } catch (error) {
    console.error('❌ Audit failed unexpectedly:', error);
    process.exit(2);
  } finally {
    await AppDataSource.destroy();
  }
}

checkBalanceConsistency();
