import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Creates the `chores` and `chore_logs` tables.
 *
 * `chores` represents recurring household tasks (NOT daily habits) — things
 * the user does every N days/weeks/months/years (e.g. "wash sheets", "rotate
 * tires"). Cadence is stored as a `(intervalValue, intervalUnit)` pair using
 * VARCHAR + CHECK rather than a Postgres ENUM type, mirroring the pattern
 * established in monthly-services view prefs.
 *
 * `chore_logs` stores each completion event. The presence of any log blocks
 * a hard delete (only soft delete via `deletedAt` is allowed in that case;
 * the application returns 409 CHRE_001 instead).
 */
export class CreateChoresTables1741000016000 implements MigrationInterface {
  name = 'CreateChoresTables1741000016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chores" (
        "id"            uuid                      NOT NULL DEFAULT gen_random_uuid(),
        "userId"        uuid                      NOT NULL,
        "name"          character varying(100)    NOT NULL,
        "notes"         text,
        "category"      character varying(50),
        "intervalValue" integer                   NOT NULL,
        "intervalUnit"  character varying(8)      NOT NULL,
        "startDate"     date                      NOT NULL,
        "lastDoneDate"  date,
        "nextDueDate"   date                      NOT NULL,
        "isActive"      boolean                   NOT NULL DEFAULT true,
        "createdAt"     TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "deletedAt"     TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_chores"                  PRIMARY KEY ("id"),
        CONSTRAINT "FK_chores_users"            FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_chores_interval_value"   CHECK ("intervalValue" > 0),
        CONSTRAINT "CK_chores_interval_unit"    CHECK ("intervalUnit" IN ('days','weeks','months','years'))
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_chores_userId" ON "chores" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_chores_userId_isActive" ON "chores" ("userId", "isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_chores_userId_nextDueDate" ON "chores" ("userId", "nextDueDate")`,
    );

    await queryRunner.query(`
      CREATE TABLE "chore_logs" (
        "id"        uuid                      NOT NULL DEFAULT gen_random_uuid(),
        "choreId"   uuid                      NOT NULL,
        "doneAt"    date                      NOT NULL,
        "note"      character varying(500),
        "createdAt" TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chore_logs"  PRIMARY KEY ("id"),
        CONSTRAINT "FK_chore_logs_chores" FOREIGN KEY ("choreId")
          REFERENCES "chores"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_chore_logs_choreId_doneAt" ON "chore_logs" ("choreId", "doneAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop logs first (FK depends on chores), then chores.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chore_logs_choreId_doneAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chore_logs"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chores_userId_nextDueDate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chores_userId_isActive"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chores_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chores"`);
  }
}
