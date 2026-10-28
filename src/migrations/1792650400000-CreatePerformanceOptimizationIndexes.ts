import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePerformanceOptimizationIndexes1792650400000 implements MigrationInterface {
  name = 'CreatePerformanceOptimizationIndexes1792650400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_submissions_perf_metrics" ON "submissions" ("status", "marks", "is_late") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_submissions_perf_batch_status" ON "submissions" ("batch_id", "status") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ca_perf_batch_user" ON "course_allocations" ("batch_id", "user_id", "status") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ca_perf_progress_due" ON "course_allocations" ("progress_percent", "due_date") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_ca_perf_progress_due"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ca_perf_batch_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_submissions_perf_batch_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_submissions_perf_metrics"`);
  }
}
