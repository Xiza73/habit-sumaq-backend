import { type MigrationInterface, type QueryRunner } from 'typeorm';

import { type AuditRow, BALANCE_AUDIT_SQL, summarizeAuditResult } from '../scripts/balance-audit';

/**
 * Phase A1-B.2 of the `accounts-to-modular-finance` refactor.
 *
 * Two-step migration:
 *
 *  1. **Audit gate** — runs the same balance-consistency check as the
 *     standalone CLI (`pnpm migration:audit-balance`). If ANY account's
 *     balance disagrees with the replayed transaction history by more
 *     than 0.5¢, throws `[POOL_001] BALANCE_DRIFT_DETECTED` and aborts
 *     the migration BEFORE any writes happen. This is defense in depth
 *     against a manual review (which the user is supposed to run via the
 *     CLI before merging) that missed a row.
 *
 *  2. **Backfill** — inserts one `currency_pools` row per
 *     `(userId, currency)` with `balance = SUM(accounts.balance)` for the
 *     active accounts in that group. Per Q1 (locked in proposal),
 *     `accounts.balance` is the SOURCE OF TRUTH — we do NOT replay the
 *     transactions to derive a new value. The audit gate above is what
 *     ensures the source is trustworthy.
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
    // ── Step 1: audit gate ────────────────────────────────────────────
    const rows = (await queryRunner.query(BALANCE_AUDIT_SQL)) as AuditRow[];
    const audit = summarizeAuditResult(rows);

    if (audit.status === 'DRIFT_DETECTED') {
      throw new Error(
        `[POOL_001] BALANCE_DRIFT_DETECTED — ${audit.totalDriftRows} of ` +
          `${audit.totalAccounts} active account(s) have balance mismatching the ` +
          `transaction history. The migration was aborted before any writes. ` +
          `Run \`pnpm migration:audit-balance\` to review each row. ` +
          `Drifts: ${JSON.stringify(audit.drifts)}`,
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
