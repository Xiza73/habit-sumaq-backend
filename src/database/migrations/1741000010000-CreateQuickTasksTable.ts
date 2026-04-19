import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateQuickTasksTable1741000010000 implements MigrationInterface {
  name = 'CreateQuickTasksTable1741000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "quick_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "title" varchar(120) NOT NULL,
        "description" text,
        "completed" boolean NOT NULL DEFAULT false,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        "position" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quick_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quick_tasks_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_quick_tasks_userId" ON "quick_tasks" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_quick_tasks_userId_position" ON "quick_tasks" ("userId", "position")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quick_tasks_userId_position"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quick_tasks_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quick_tasks"`);
  }
}
