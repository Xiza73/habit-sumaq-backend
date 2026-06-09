import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase A4-B.3 of the `accounts-to-modular-finance` refactor. Copies
 * every legacy `transactions` row where `monthlyServiceId IS NOT NULL`
 * into the new native `monthly_service_payments` table.
 *
 * Filter rationale:
 *   - `type = 'EXPENSE'`: defensive — service payments are always
 *     expenses. The legacy UI never let you tag INCOME with a
 *     monthlyServiceId, but we filter anyway.
 *   - `monthlyServiceId IS NOT NULL`: the selector.
 *   - `amount > 0`: same defense as in debts-loans and budget-movements
 *     migrations — skip zero/negative-amount garbage.
 *
 * Currency is JOINed from the LEGACY `monthly_services.currency`
 * column (NOT from accounts) — that field already exists on the
 * monthly_services table and is the authoritative currency for the
 * service.
 *
 * Period reconstruction:
 *   The legacy `transactions` row does NOT store which calendar period
 *   the payment was FOR — it only stores the calendar date of the
 *   payment itself. We use `TO_CHAR(t.date, 'YYYY-MM')` as the period
 *   on the assumption that the user paid for the current calendar
 *   month at the time of payment. This is correct in the common case
 *   ("paid Netflix today for this month") and only slightly off in
 *   back-pay scenarios ("paid last month's Netflix today, on the 5th
 *   of this month"). For single-user-prod this is good enough; the
 *   user can manually re-assign periods post-migration if needed.
 *
 * Legacy duplicate handling:
 *   In the wild we found multiple legacy payments for the same
 *   `(monthlyServiceId, calendar-month)` pair — typical causes are
 *   accidental double-payments, manual corrections, or the legacy UI
 *   allowing it. The new schema's partial unique index forbids that
 *   combination, so we DEDUPE in the SELECT via `DISTINCT ON
 *   (monthlyServiceId, period)` and `ORDER BY ... createdAt DESC` —
 *   the LATEST payment for each pair survives (most likely the
 *   intended one). The older payment(s) are silently dropped during
 *   migration; the original `transactions` rows are still alive so
 *   recovery is possible via the `pre_v1_data_backup_v1` table.
 *
 * Soft-deleted legacy rows ARE migrated (deletedAt preserved). The
 * partial unique index excludes them so they don't compete with active
 * rows for the same period.
 *
 * Legacy `transactions` rows stay alive until A6.
 */
export class MigrateMonthlyServicePaymentTransactions1741000033000 implements MigrationInterface {
  name = 'MigrateMonthlyServicePaymentTransactions1741000033000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "monthly_service_payments" (
        "id",
        "userId",
        "monthlyServiceId",
        "currency",
        "amount",
        "period",
        "description",
        "date",
        "createdAt",
        "updatedAt",
        "deletedAt"
      )
      SELECT DISTINCT ON (t."monthlyServiceId", TO_CHAR(t."date", 'YYYY-MM'))
        t."id",
        t."userId",
        t."monthlyServiceId",
        ms."currency",
        t."amount",
        TO_CHAR(t."date", 'YYYY-MM') AS period,
        t."description",
        t."date",
        t."createdAt",
        t."updatedAt",
        t."deletedAt"
      FROM "transactions" t
      INNER JOIN "monthly_services" ms ON ms.id = t."monthlyServiceId"
      WHERE t."monthlyServiceId" IS NOT NULL
        AND t."type" = 'EXPENSE'
        AND t."amount" > 0
      ORDER BY t."monthlyServiceId", TO_CHAR(t."date", 'YYYY-MM'), t."createdAt" DESC
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Mirror of debts-loans + budget-movements down(): delete only
    // rows that originated in legacy `transactions`. A row is "from
    // this migration" if a transactions row with matching id still
    // exists with `monthlyServiceId IS NOT NULL`.
    await queryRunner.query(`
      DELETE FROM "monthly_service_payments" msp
      WHERE EXISTS (
        SELECT 1
        FROM "transactions" t
        WHERE t."id" = msp."id"
          AND t."monthlyServiceId" IS NOT NULL
      )
    `);
  }
}
