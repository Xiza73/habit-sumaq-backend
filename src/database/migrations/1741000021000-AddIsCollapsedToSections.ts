import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Adds `isCollapsed` to `sections` so the per-section "collapsed in the
 * task dashboard" UI state survives refreshes and follows the user across
 * devices. Defaults to FALSE — every existing section keeps its current
 * visible-by-default behavior.
 */
export class AddIsCollapsedToSections1741000021000 implements MigrationInterface {
  name = 'AddIsCollapsedToSections1741000021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sections" ADD COLUMN "isCollapsed" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sections" DROP COLUMN "isCollapsed"`);
  }
}
