import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateTransactionsTable1741000003000 implements MigrationInterface {
  name = 'CreateTransactionsTable1741000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "transaction_type_enum" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER')`,
    );

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id"                    uuid                      NOT NULL DEFAULT gen_random_uuid(),
        "userId"                uuid                      NOT NULL,
        "accountId"             uuid                      NOT NULL,
        "categoryId"            uuid,
        "type"                  "transaction_type_enum"   NOT NULL,
        "amount"                numeric(15,2)             NOT NULL,
        "description"           character varying(255),
        "date"                  TIMESTAMP WITH TIME ZONE  NOT NULL,
        "destinationAccountId"  uuid,
        "createdAt"             TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "deletedAt"             TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_transactions"              PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_users"        FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_accounts"     FOREIGN KEY ("accountId")
          REFERENCES "accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_categories"   FOREIGN KEY ("categoryId")
          REFERENCES "categories"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_transactions_dest_account" FOREIGN KEY ("destinationAccountId")
          REFERENCES "accounts"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_transactions_userId" ON "transactions" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_accountId" ON "transactions" ("accountId")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_transactions_date" ON "transactions" ("date")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "transaction_type_enum"`);
  }
}
