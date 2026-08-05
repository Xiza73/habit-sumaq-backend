import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Adds a `deletedAt` soft-delete marker to `chore_logs`.
 *
 * Needed by POST /chores/:id/revert-last-done: undoing the last completion
 * soft-deletes the most recent log instead of hard-deleting it, so the event
 * history stays auditable while dropping out of `GET /chores/:id/logs`.
 * TypeORM's @DeleteDateColumn auto-excludes rows with a non-null `deletedAt`.
 */
export class AddDeletedAtToChoreLogs1741000039000 implements MigrationInterface {
  name = 'AddDeletedAtToChoreLogs1741000039000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chore_logs" ADD COLUMN "deletedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chore_logs" DROP COLUMN "deletedAt"`);
  }
}
