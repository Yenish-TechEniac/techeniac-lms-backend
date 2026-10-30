import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQueueAndLatestSubmissionIndexes1792650600000 implements MigrationInterface {
  name = 'AddQueueAndLatestSubmissionIndexes1792650600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_submissions_active_latest_ver" ON "submissions" ("course_allocation_id", "assignment_id", "version") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_submissions_queue_lookup" ON "submissions" ("batch_id", "status", "submitted_at") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_submissions_perf_batch_status"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_submissions_perf_batch_status" ON "submissions" ("batch_id", "status") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_submissions_queue_lookup"`);
    await queryRunner.query(`DROP INDEX "public"."idx_submissions_active_latest_ver"`);
  }
}
