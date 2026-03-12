import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateUserSettingsTable1741000005000 implements MigrationInterface {
  name = 'CreateUserSettingsTable1741000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "language_enum" AS ENUM ('es', 'en', 'pt')`);
    await queryRunner.query(`CREATE TYPE "theme_enum" AS ENUM ('light', 'dark', 'system')`);
    await queryRunner.query(
      `CREATE TYPE "date_format_enum" AS ENUM ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')`,
    );
    await queryRunner.query(`CREATE TYPE "start_of_week_enum" AS ENUM ('monday', 'sunday')`);

    await queryRunner.query(`
      CREATE TABLE "user_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "language" "language_enum" NOT NULL DEFAULT 'es',
        "theme" "theme_enum" NOT NULL DEFAULT 'system',
        "defaultCurrency" "currency_enum" NOT NULL DEFAULT 'PEN',
        "dateFormat" "date_format_enum" NOT NULL DEFAULT 'DD/MM/YYYY',
        "startOfWeek" "start_of_week_enum" NOT NULL DEFAULT 'monday',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_settings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_settings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_settings_userId" ON "user_settings" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_settings_userId"`);
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(`DROP TYPE "start_of_week_enum"`);
    await queryRunner.query(`DROP TYPE "date_format_enum"`);
    await queryRunner.query(`DROP TYPE "theme_enum"`);
    await queryRunner.query(`DROP TYPE "language_enum"`);
  }
}
