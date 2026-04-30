import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateTasksTable1741000020000 implements MigrationInterface {
  name = 'CreateTasksTable1741000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id"            uuid                      NOT NULL DEFAULT gen_random_uuid(),
        "userId"        uuid                      NOT NULL,
        "sectionId"     uuid                      NOT NULL,
        "title"         character varying(120)    NOT NULL,
        "description"   text,
        "completed"     boolean                   NOT NULL DEFAULT false,
        "completedAt"   TIMESTAMP WITH TIME ZONE,
        "position"      integer                   NOT NULL DEFAULT 1,
        "createdAt"     TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tasks"           PRIMARY KEY ("id"),
        CONSTRAINT "FK_tasks_users"     FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tasks_sections"  FOREIGN KEY ("sectionId")
          REFERENCES "sections"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_tasks_completed_consistency"
          CHECK (("completed" = false AND "completedAt" IS NULL)
                 OR ("completed" = true AND "completedAt" IS NOT NULL))
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_tasks_userId" ON "tasks" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_sectionId_position" ON "tasks" ("sectionId", "position")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_userId_completedAt" ON "tasks" ("userId", "completedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_userId_completedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_sectionId_position"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
  }
}
