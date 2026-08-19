import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Recordatorios: algo que hay que hacer una vez, opcionalmente en una fecha,
 * opcionalmente a una hora.
 *
 * `remindDate` es `date` y no `timestamptz` a propósito — el día es el día
 * calendario del usuario, y un timestamp lo correría de lado apenas viaje.
 * Misma razón por la que `habit_logs.date` y `chores.nextDueDate` son `date`.
 *
 * El CHECK es la contraparte en la base de la regla del dominio: una hora sin
 * fecha no dice nada sobre cuándo pasa algo que pasa una vez, así que ese
 * estado no debe poder existir ni entrando por SQL.
 */
export class CreateReminders1741000041000 implements MigrationInterface {
  name = 'CreateReminders1741000041000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reminders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "title" character varying(120) NOT NULL,
        "notes" text,
        "remindDate" date,
        "remindTime" time,
        "completed" boolean NOT NULL DEFAULT false,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reminders" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_reminders_time_needs_date"
          CHECK ("remindTime" IS NULL OR "remindDate" IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "reminders"
      ADD CONSTRAINT "FK_reminders_users"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`CREATE INDEX "IDX_reminders_userId" ON "reminders" ("userId")`);
    // The alerts builder reads "pending and dated" on every bell open.
    await queryRunner.query(`
      CREATE INDEX "IDX_reminders_userId_completed_remindDate"
      ON "reminders" ("userId", "completed", "remindDate")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_reminders_userId_completed_remindDate"`);
    await queryRunner.query(`DROP INDEX "IDX_reminders_userId"`);
    await queryRunner.query(`ALTER TABLE "reminders" DROP CONSTRAINT "FK_reminders_users"`);
    await queryRunner.query(`DROP TABLE "reminders"`);
  }
}
