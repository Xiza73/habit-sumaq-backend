import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateSectionsTable1741000019000 implements MigrationInterface {
  name = 'CreateSectionsTable1741000019000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sections" (
        "id"          uuid                      NOT NULL DEFAULT gen_random_uuid(),
        "userId"      uuid                      NOT NULL,
        "name"        character varying(60)     NOT NULL,
        "color"       character varying(7),
        "position"    integer                   NOT NULL DEFAULT 1,
        "createdAt"   TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sections"        PRIMARY KEY ("id"),
        CONSTRAINT "FK_sections_users"  FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_sections_color"  CHECK ("color" IS NULL OR "color" ~ '^#[0-9a-fA-F]{6}$')
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_sections_userId_position" ON "sections" ("userId", "position")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sections_userId_position"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sections"`);
  }
}
