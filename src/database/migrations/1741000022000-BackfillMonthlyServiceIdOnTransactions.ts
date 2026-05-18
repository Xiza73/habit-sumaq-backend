import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Backfill `transactions.monthly_service_id` for legacy rows.
 *
 * The column + FK landed on `1741000012000` and from that point on
 * `PayMonthlyServiceUseCase` populates it on every new payment. But any
 * transaction created BEFORE the populate logic was wired (or via a code
 * path that bypassed the service flow) still has `monthly_service_id = NULL`
 * — so the new `paidAmountForCurrentMonth` aggregate (PR #29) silently
 * underreports for users with legacy payment history.
 *
 * Matching strategy — conservative, exact-default-description only:
 *   - `userId` matches the service's `userId`
 *   - `type = 'EXPENSE'` (every service payment is an EXPENSE)
 *   - `categoryId` matches the service's `categoryId` (single-category by design)
 *   - `monthlyServiceId IS NULL` (don't overwrite existing links)
 *   - `deletedAt IS NULL` (skip soft-deleted rows)
 *   - `LOWER(TRIM(description)) = LOWER(TRIM(service.name))`
 *   - `date >= service.createdAt` (no time travel before the service existed)
 *
 * The description equality is the load-bearing match: the pay use case
 * defaults `description` to `service.name` verbatim when the user doesn't
 * override it, so virtually every legacy auto-paid TX is caught. Users who
 * customized their descriptions (e.g. "Pago Netflix febrero") are NOT
 * backfilled — that's intentional: a fuzzy match would risk linking
 * unrelated category-mate expenses, which is worse than under-reporting.
 *
 * Safe to re-run: the `monthlyServiceId IS NULL` filter makes it idempotent.
 * Reversible too — the DOWN migration NULLs out the rows this migration
 * touched. We can't tell after the fact which rows came from the backfill
 * vs the live populate, so DOWN is a no-op with a comment rather than a
 * destructive rollback.
 */
export class BackfillMonthlyServiceIdOnTransactions1741000022000 implements MigrationInterface {
  name = 'BackfillMonthlyServiceIdOnTransactions1741000022000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "transactions" AS tx
      SET "monthlyServiceId" = ms.id
      FROM "monthly_services" AS ms
      WHERE tx."userId" = ms."userId"
        AND tx."type" = 'EXPENSE'
        AND tx."categoryId" = ms."categoryId"
        AND tx."monthlyServiceId" IS NULL
        AND tx."deletedAt" IS NULL
        AND tx."description" IS NOT NULL
        AND LOWER(TRIM(tx."description")) = LOWER(TRIM(ms."name"))
        AND tx."date" >= ms."createdAt"
    `);
  }

  public async down(): Promise<void> {
    // Intentional no-op. After the backfill runs there's no way to
    // distinguish backfilled links from links written live by
    // PayMonthlyServiceUseCase — NULLing every monthlyServiceId would
    // destroy real data. If a rollback is ever needed, restore from a
    // pre-migration snapshot.
  }
}
