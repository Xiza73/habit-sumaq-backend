import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDebtLoanFields1741000004000 implements MigrationInterface {
  name = 'AddDebtLoanFields1741000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "transaction_type_enum" ADD VALUE 'DEBT'`);
    await queryRunner.query(`ALTER TYPE "transaction_type_enum" ADD VALUE 'LOAN'`);

    await queryRunner.query(`CREATE TYPE "transaction_status_enum" AS ENUM ('PENDING', 'SETTLED')`);

    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN "reference" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN "status" "transaction_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN "relatedTransactionId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN "remainingAmount" numeric(15,2)`,
    );

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD CONSTRAINT "FK_transactions_related"
        FOREIGN KEY ("relatedTransactionId")
        REFERENCES "transactions"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`CREATE INDEX "IDX_transactions_status" ON "transactions" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_relatedTransactionId" ON "transactions" ("relatedTransactionId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_transactions_relatedTransactionId"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_status"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_related"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "remainingAmount"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "relatedTransactionId"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "reference"`);
    await queryRunner.query(`DROP TYPE "transaction_status_enum"`);
    // Note: PostgreSQL does not support removing values from an enum type.
    // To fully revert DEBT/LOAN, recreate the enum and update the column.
  }
}
