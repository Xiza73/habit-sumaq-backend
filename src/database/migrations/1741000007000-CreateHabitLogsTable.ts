import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHabitLogsTable1741000007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "habit_logs" (
        "id"          uuid            NOT NULL DEFAULT uuid_generate_v4(),
        "habitId"     uuid            NOT NULL,
        "userId"      uuid            NOT NULL,
        "date"        date            NOT NULL,
        "count"       smallint        NOT NULL DEFAULT 0,
        "completed"   boolean         NOT NULL DEFAULT false,
        "note"        character varying(500),
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_habit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_habit_logs_habitId" FOREIGN KEY ("habitId")
          REFERENCES "habits"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_habit_logs_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_habit_logs_habitId_date"
        ON "habit_logs" ("habitId", "date")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_habit_logs_userId_date"
        ON "habit_logs" ("userId", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "habit_logs"`);
  }
}
