import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHabitsTable1741000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "habit_frequency_enum" AS ENUM ('DAILY', 'WEEKLY')
    `);

    await queryRunner.query(`
      CREATE TABLE "habits" (
        "id"            uuid            NOT NULL DEFAULT uuid_generate_v4(),
        "userId"        uuid            NOT NULL,
        "name"          character varying(100)  NOT NULL,
        "description"   character varying(500),
        "frequency"     "habit_frequency_enum"  NOT NULL,
        "targetCount"   smallint        NOT NULL DEFAULT 1,
        "color"         character varying(7),
        "icon"          character varying(50),
        "isArchived"    boolean         NOT NULL DEFAULT false,
        "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt"     TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_habits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_habits_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_habits_userId_name"
        ON "habits" ("userId", "name")
        WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_habits_userId"
        ON "habits" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "habits"`);
    await queryRunner.query(`DROP TYPE "habit_frequency_enum"`);
  }
}
