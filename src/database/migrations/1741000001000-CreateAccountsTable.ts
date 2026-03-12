import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateAccountsTable1741000001000 implements MigrationInterface {
  name = 'CreateAccountsTable1741000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "account_type_enum" AS ENUM ('checking', 'savings', 'cash', 'credit_card', 'investment')`,
    );
    await queryRunner.query(`CREATE TYPE "currency_enum" AS ENUM ('PEN', 'USD', 'EUR')`);

    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id"          uuid                      NOT NULL DEFAULT gen_random_uuid(),
        "userId"      uuid                      NOT NULL,
        "name"        character varying(100)    NOT NULL,
        "type"        "account_type_enum"        NOT NULL,
        "currency"    "currency_enum"            NOT NULL,
        "balance"     numeric(15,2)             NOT NULL DEFAULT '0.00',
        "color"       character varying(7),
        "icon"        character varying(50),
        "isArchived"  boolean                   NOT NULL DEFAULT false,
        "createdAt"   TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "deletedAt"   TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_accounts"        PRIMARY KEY ("id"),
        CONSTRAINT "FK_accounts_users"  FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_accounts_userId" ON "accounts" ("userId")`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_accounts_userId_name"
        ON "accounts" ("userId", "name")
        WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP TYPE "currency_enum"`);
    await queryRunner.query(`DROP TYPE "account_type_enum"`);
  }
}
