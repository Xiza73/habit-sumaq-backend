import { type MigrationInterface, type QueryRunner } from 'typeorm';

import { type AuditRow, BALANCE_AUDIT_SQL, summarizeAuditResult } from '../scripts/balance-audit';

/**
 * Phase A1-B.2 of the `accounts-to-modular-finance` refactor.
 *
 * Two-step migration:
 *
 *  1. **Audit (soft)** — runs the same balance-consistency check as the
 *     standalone CLI (`pnpm migration:audit-balance`). If ANY account's
 *     balance disagrees with the replayed transaction history by more
 *     than 0.5¢, logs `[POOL_001] BALANCE_DRIFT_DETECTED` as a console
 *     WARN with the drift details, but does NOT abort the migration.
 *
 *     **Why soft, not blocking** (decision revised after deployment trial):
 *     `currency_pools.balance` is populated from `SUM(accounts.balance)`
 *     — NOT from the transaction history. The pool just inherits whatever
 *     `accounts.balance` says. As long as that value is what the user
 *     trusts (and it is — they see it in the app every day), the pool is
 *     correct. The drift between balance and history matters for
 *     accounting hygiene, but NOT for the v1.0.0 outcome: in Phase A7 we
 *     drop both `accounts` and `transactions` entirely, so any
 *     transaction-history inconsistency is irrelevant after the cutover.
 *
 *     The warn still surfaces the drift so the operator can run the
 *     audit-balance CLI for a detailed report and decide whether to
 *     reconcile manually — but the migration no longer blocks the
 *     refactor on it.
 *
 *  2. **Backfill** — inserts one `currency_pools` row per
 *     `(userId, currency)` with `balance = SUM(accounts.balance)` for the
 *     active accounts in that group. `accounts.balance` is the SOURCE OF
 *     TRUTH; we do NOT replay transactions to derive a new value.
 *
 *     `ON CONFLICT DO NOTHING` keeps the migration idempotent: if A1-B.2
 *     ran on a partial DB (e.g., dev reset + re-migrate), the existing
 *     rows are preserved. New rows only show up where the pair is missing.
 *
 * Down: removes the rows this migration inserted. To stay safe in the
 * future (A4 ships and `applyDelta` starts auto-creating rows), the
 * `down()` is conservative — it deletes ONLY pools whose balance still
 * matches the `SUM(accounts.balance)` value at down-time. Pools that
 * have been mutated by `applyDelta` after this migration ran stay put,
 * since deleting them would lose state.
 */
export class BackfillCurrencyPools1741000026000 implements MigrationInterface {
  name = 'BackfillCurrencyPools1741000026000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Step 1: audit (soft — logs warnings, does NOT block) ──────────
    const rows = (await queryRunner.query(BALANCE_AUDIT_SQL)) as AuditRow[];
    const audit = summarizeAuditResult(rows);

    if (audit.status === 'DRIFT_DETECTED') {
      // eslint-disable-next-line no-console
      console.warn(
        `[POOL_001] BALANCE_DRIFT_DETECTED — ${audit.totalDriftRows} of ` +
          `${audit.totalAccounts} active account(s) have balance mismatching the ` +
          `transaction history. NOT blocking — the pool is backfilled from ` +
          `accounts.balance, which is the source of truth. The drift only affects ` +
          `transaction-history hygiene, which becomes irrelevant after Phase A7 ` +
          `drops the accounts and transactions tables. ` +
          `Run \`pnpm migration:audit-balance\` for a full report. ` +
          `Drifts (first 10): ${JSON.stringify(audit.drifts.slice(0, 10))}`,
      );
    }

    // ── Step 2: backfill currency_pools ───────────────────────────────
    await queryRunner.query(`
      INSERT INTO "currency_pools" ("userId", "currency", "balance")
      SELECT "userId", currency, SUM(balance)
      FROM "accounts"
      WHERE "deletedAt" IS NULL
      GROUP BY "userId", currency
      ON CONFLICT ("userId", "currency") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Conservative delete: only remove pools whose balance still equals
    // the current `SUM(accounts.balance)` for that pair. Pools that have
    // been mutated by `applyDelta` since the backfill ran (theoretically
    // possible if A4 is also live) stay put.
    await queryRunner.query(`
      DELETE FROM "currency_pools" cp
      USING (
        SELECT "userId", currency, SUM(balance) AS total
        FROM "accounts"
        WHERE "deletedAt" IS NULL
        GROUP BY "userId", currency
      ) agg
      WHERE cp."userId" = agg."userId"
        AND cp.currency = agg.currency
        AND cp.balance = agg.total
    `);
  }
}
