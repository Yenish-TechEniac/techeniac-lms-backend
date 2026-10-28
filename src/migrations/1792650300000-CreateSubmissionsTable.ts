import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubmissionsTable1792650300000 implements MigrationInterface {
  name = 'CreateSubmissionsTable1792650300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "submissions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "course_allocation_id" uuid NOT NULL, "assignment_id" uuid NOT NULL, "batch_id" uuid, "version" integer NOT NULL DEFAULT '1', "submission_data" jsonb NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_late" boolean NOT NULL DEFAULT false, "status" character varying(30) NOT NULL DEFAULT 'SUBMITTED', "marks" numeric(8,2), "grade_label" character varying(50), "feedback" text, "graded_by" uuid, "graded_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_sub_has_data" CHECK (submission_data <> '{}'::jsonb), CONSTRAINT "chk_sub_marks" CHECK (marks IS NULL OR marks >= 0), CONSTRAINT "chk_sub_graded_fields" CHECK (status <> 'GRADED' OR (marks IS NOT NULL AND graded_by IS NOT NULL AND graded_at IS NOT NULL)), CONSTRAINT "uq_sub_version" UNIQUE ("course_allocation_id", "assignment_id", "version"), CONSTRAINT "PK_10b3be95b8b2fb1e482e07d706b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sub_queue" ON "submissions" ("batch_id", "submitted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sub_status_time" ON "submissions" ("status", "submitted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sub_allocation_assignment" ON "submissions" ("course_allocation_id", "assignment_id") `,
    );
    await queryRunner.query(`CREATE INDEX "idx_sub_grader" ON "submissions" ("graded_by") `);
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD CONSTRAINT "FK_submissions_assignment" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD CONSTRAINT "FK_submissions_batch" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD CONSTRAINT "FK_submissions_grader" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_submissions_grader"`);
    await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_submissions_batch"`);
    await queryRunner.query(
      `ALTER TABLE "submissions" DROP CONSTRAINT "FK_submissions_assignment"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_sub_grader"`);
    await queryRunner.query(`DROP INDEX "public"."idx_sub_allocation_assignment"`);
    await queryRunner.query(`DROP INDEX "public"."idx_sub_status_time"`);
    await queryRunner.query(`DROP INDEX "public"."idx_sub_queue"`);
    await queryRunner.query(`DROP TABLE "submissions"`);
  }
}
