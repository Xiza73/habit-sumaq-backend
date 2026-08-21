import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * `tasks.completed` (boolean) → `tasks.status` (enum).
 *
 * El booleano necesitaba un tercer valor: "la terminé pero la estoy
 * validando". Agregar un flag al lado habría permitido `completed &&
 * inReview`, una combinación sin significado que cada consumidor tendría que
 * prohibir a mano. El estado es lineal, así que el tipo lineal es un enum.
 *
 * El backfill es total y sin pérdida: `completed = true` → `DONE`, el resto
 * → `PENDING`. Ninguna fila existente puede quedar en `IN_REVIEW`, que es
 * correcto — ese estado no existía cuando se escribieron.
 */
export class AddStatusToTasks1741000042000 implements MigrationInterface {
  name = 'AddStatusToTasks1741000042000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "tasks_status_enum" AS ENUM ('PENDING', 'IN_REVIEW', 'DONE')
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "status" "tasks_status_enum" NOT NULL DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
      UPDATE "tasks" SET "status" = 'DONE' WHERE "completed" = true
    `);

    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "completed"`);

    // The weekly cleanup reads "DONE and completedAt older than the week
    // start", so the index that served the boolean lookup is re-pointed at
    // the column that replaced it.
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_userId_status_completedAt"
      ON "tasks" ("userId", "status", "completedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_tasks_userId_status_completedAt"`);

    await queryRunner.query(`
      ALTER TABLE "tasks" ADD COLUMN "completed" boolean NOT NULL DEFAULT false
    `);

    // IN_REVIEW collapses to false on the way down: the boolean has nowhere
    // to put it, and calling an unverified task complete would be worse than
    // calling it pending.
    await queryRunner.query(`
      UPDATE "tasks" SET "completed" = true WHERE "status" = 'DONE'
    `);

    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "tasks_status_enum"`);
  }
}
