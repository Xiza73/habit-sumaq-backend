import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateCategoriesTable1741000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "category_type_enum" AS ENUM ('INCOME', 'EXPENSE')
    `);

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id"          UUID                  NOT NULL DEFAULT gen_random_uuid(),
        "userId"      UUID                  NOT NULL,
        "name"        VARCHAR(100)          NOT NULL,
        "type"        "category_type_enum"  NOT NULL,
        "color"       VARCHAR(7)            DEFAULT NULL,
        "icon"        VARCHAR(50)           DEFAULT NULL,
        "isDefault"   BOOLEAN               NOT NULL DEFAULT false,
        "createdAt"   TIMESTAMPTZ           NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMPTZ           NOT NULL DEFAULT now(),
        "deletedAt"   TIMESTAMPTZ           DEFAULT NULL,
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_categories_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_categories_userId"
        ON "categories" ("userId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categories_userId_name"
        ON "categories" ("userId", "name")
        WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TYPE "category_type_enum"`);
  }
}
