import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Enables the `unaccent` Postgres extension so we can do case-insensitive AND
 * accent-insensitive search over free-form string fields (reference, name,
 * description). Used by the debts-summary endpoint to group transactions
 * written as "Juán", "Juan", "JUAN" as a single person.
 */
export class EnableUnaccentExtension1741000008000 implements MigrationInterface {
  name = 'EnableUnaccentExtension1741000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }
}
