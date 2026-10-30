import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQueueAndLatestSubmissionIndexes1792650500000 implements MigrationInterface {
  name = 'AddQueueAndLatestSubmissionIndexes1792650500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submissions_active_latest_ver" ON "submissions" ("course_allocation_id", "assignment_id", "version" DESC) WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_submissions_queue_lookup" ON "submissions" ("batch_id", "status", "submitted_at" DESC) WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_submissions_queue_lookup"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_submissions_active_latest_ver"`);
  }
}
