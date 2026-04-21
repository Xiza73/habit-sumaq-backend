import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateMonthlyServicesTable1741000011000 implements MigrationInterface {
  name = 'CreateMonthlyServicesTable1741000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "monthly_services" (
        "id"                  uuid                      NOT NULL DEFAULT gen_random_uuid(),
        "userId"              uuid                      NOT NULL,
        "name"                character varying(100)    NOT NULL,
        "defaultAccountId"    uuid                      NOT NULL,
        "categoryId"          uuid                      NOT NULL,
        "currency"            character varying(3)      NOT NULL,
        "estimatedAmount"     numeric(15,2),
        "dueDay"              integer,
        "startPeriod"         character varying(7)      NOT NULL,
        "lastPaidPeriod"      character varying(7),
        "isActive"            boolean                   NOT NULL DEFAULT true,
        "createdAt"           TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "deletedAt"           TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_monthly_services"              PRIMARY KEY ("id"),
        CONSTRAINT "FK_monthly_services_users"        FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_monthly_services_default_acc"  FOREIGN KEY ("defaultAccountId")
          REFERENCES "accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_monthly_services_categories"   FOREIGN KEY ("categoryId")
          REFERENCES "categories"("id") ON DELETE RESTRICT,
        CONSTRAINT "CK_monthly_services_due_day"      CHECK ("dueDay" IS NULL OR ("dueDay" BETWEEN 1 AND 31))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_monthly_services_user_name_active"
        ON "monthly_services" ("userId", "name")
        WHERE "isActive" = true
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_monthly_services_userId" ON "monthly_services" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_monthly_services_userId_isActive" ON "monthly_services" ("userId", "isActive")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_monthly_services_userId_isActive"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_monthly_services_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_monthly_services_user_name_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "monthly_services"`);
  }
}
