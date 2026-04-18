import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddTimezoneToUserSettings1741000009000 implements MigrationInterface {
  name = 'AddTimezoneToUserSettings1741000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD COLUMN "timezone" varchar(64) NOT NULL DEFAULT 'UTC'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "timezone"`);
  }
}
