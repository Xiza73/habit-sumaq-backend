import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateUsersTable1741000000000 implements MigrationInterface {
  name = 'CreateUsersTable1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
        "googleId"    character varying        NOT NULL,
        "email"       character varying        NOT NULL,
        "name"        character varying        NOT NULL,
        "avatarUrl"   character varying,
        "isActive"    boolean                  NOT NULL DEFAULT true,
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt"   TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_users_googleId" UNIQUE ("googleId"),
        CONSTRAINT "UQ_users_email"    UNIQUE ("email"),
        CONSTRAINT "PK_users"          PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
