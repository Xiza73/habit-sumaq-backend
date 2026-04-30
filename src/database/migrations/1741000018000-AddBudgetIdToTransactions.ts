import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddBudgetIdToTransactions1741000018000 implements MigrationInterface {
  name = 'AddBudgetIdToTransactions1741000018000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD COLUMN "budgetId" uuid
    `);

    // ON DELETE SET NULL — if a budget is hard-deleted (we soft-delete by
    // default, but Postgres-level cascade is the safety net), the linked
    // expense survives without a budget tag. The application also clears
    // budgetId explicitly during soft-delete.
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_budgets"
      FOREIGN KEY ("budgetId")
      REFERENCES "budgets"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_budgetId" ON "transactions" ("budgetId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_budgetId"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_budgets"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "budgetId"`);
  }
}
