import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddMonthlyServiceIdToTransactions1741000012000 implements MigrationInterface {
  name = 'AddMonthlyServiceIdToTransactions1741000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD COLUMN "monthlyServiceId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_monthly_services"
      FOREIGN KEY ("monthlyServiceId")
      REFERENCES "monthly_services"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_monthlyServiceId" ON "transactions" ("monthlyServiceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_monthlyServiceId"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_monthly_services"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "monthlyServiceId"`);
  }
}
