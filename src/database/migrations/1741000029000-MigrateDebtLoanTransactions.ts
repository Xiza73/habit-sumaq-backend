import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase A3-B of the `accounts-to-modular-finance` refactor. Copies every
 * `DEBT` / `LOAN` row from the legacy `transactions` table into the new
 * native `debts_loans` table created by the previous migration
 * (`1741000028000-CreateDebtsLoansTable`).
 *
 * Per Q1 (locked in proposal): the legacy `transactions` rows are NOT
 * deleted by this migration. They stay alive in the source table until
 * Phase A6 retires the transactions module entirely and A7 drops the
 * table. The dual existence is fine during the dual-write window —
 * `debts_loans` is the new authoritative source from this point on, and
 * the legacy endpoints still read from `transactions` until A6 swaps
 * them.
 *
 * Carries over from `transactions`:
 *  - id (so any external reference to the legacy row continues to point
 *    to the same UUID — easier debugging + recovery from the
 *    `pre_v1_data_backup_v1` table if needed)
 *  - userId, type, categoryId, amount, remainingAmount, status, reference,
 *    description, date, createdAt, updatedAt, deletedAt
 *  - currency — pulled from the JOINed `accounts` row (transactions never
 *    stored their own currency; they inherited from the source account)
 *
 * Skips:
 *  - Rows with NULL or empty `reference` — they were created with a bug
 *    that bypassed the `REFERENCE_REQUIRED` check, or via the
 *    `relatedTransactionId` settlement chain (which are EXPENSE/INCOME,
 *    not DEBT/LOAN). Our new schema has `reference NOT NULL`.
 *  - Settlement rows themselves (they're EXPENSE/INCOME with
 *    `relatedTransactionId` pointing back to a DEBT/LOAN). Those are
 *    not standalone obligations and don't migrate.
 *
 * Soft-deleted rows ARE migrated (their `deletedAt` is preserved).
 * Recovery from `pre_v1_data_backup_v1` already covers the row data, but
 * keeping the soft-delete history in the live table is useful for any
 * UI that filters by `deletedAt` going forward.
 *
 * Idempotent via `ON CONFLICT (id) DO NOTHING` — re-running the
 * migration after a partial failure or a dev reset is safe.
 */
export class MigrateDebtLoanTransactions1741000029000 implements MigrationInterface {
  name = 'MigrateDebtLoanTransactions1741000029000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clamp `remainingAmount` to the [0, amount] range. The legacy
    // `transactions` table did NOT enforce this invariant; in the wild
    // we've seen rows where `remainingAmount > amount` (typically because
    // the user edited the amount DOWN after a partial settle without
    // recomputing remaining, or because of an old settle bug). The new
    // schema's CK_debts_loans_remaining_within_amount enforces this
    // invariant strictly, so we clamp on the way in.
    //
    // Interpretation when clamping:
    //   - remaining > amount → cap at amount (the worst case: full
    //     amount still owed, as if no settle ever happened).
    //   - remaining < 0     → floor at 0 (over-settled rows become
    //     fully SETTLED on the next status calc).
    //
    // We also skip rows where `amount <= 0` — the new schema's
    // `CK_debts_loans_amount_positive` would reject them anyway, and a
    // DEBT/LOAN of zero magnitude is meaningless.
    //
    // Status is recomputed: if the (clamped) remaining is 0, force
    // SETTLED — otherwise PENDING. This catches legacy rows that were
    // marked PENDING but had no remainder, and rows whose remainder we
    // just floored to 0.
    await queryRunner.query(`
      INSERT INTO "debts_loans" (
        "id",
        "userId",
        "type",
        "categoryId",
        "currency",
        "amount",
        "remainingAmount",
        "status",
        "reference",
        "description",
        "date",
        "createdAt",
        "updatedAt",
        "deletedAt"
      )
      SELECT
        t."id",
        t."userId",
        t."type",
        t."categoryId",
        a."currency",
        t."amount",
        GREATEST(0, LEAST(COALESCE(t."remainingAmount", t."amount"), t."amount"))
          AS clamped_remaining,
        CASE
          WHEN GREATEST(0, LEAST(COALESCE(t."remainingAmount", t."amount"), t."amount")) = 0
            THEN 'SETTLED'
          ELSE 'PENDING'
        END AS computed_status,
        t."reference",
        t."description",
        t."date",
        t."createdAt",
        t."updatedAt",
        t."deletedAt"
      FROM "transactions" t
      INNER JOIN "accounts" a ON a.id = t."accountId"
      WHERE t."type" IN ('DEBT', 'LOAN')
        AND t."reference" IS NOT NULL
        AND t."reference" <> ''
        AND t."amount" > 0
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The down path removes ONLY rows that came from this migration. We
    // identify them by checking whether the same id still exists in
    // `transactions` with the matching type — if yes, this `debts_loans`
    // row was migrated and is safe to delete. If no, the row was created
    // post-A3 by the new module's create endpoint and must NOT be
    // touched.
    await queryRunner.query(`
      DELETE FROM "debts_loans" dl
      WHERE EXISTS (
        SELECT 1
        FROM "transactions" t
        WHERE t."id" = dl."id"
          AND t."type" IN ('DEBT', 'LOAN')
      )
    `);
  }
}
