import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourseAllocationTables1792650100000 implements MigrationInterface {
  name = 'CreateCourseAllocationTables1792650100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."course_allocations_status_enum" AS ENUM('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REVOKED', 'CLOSED_ROLE_CHANGE', 'CLOSED_BATCH_CHANGE')`,
    );

    await queryRunner.query(`
      CREATE TABLE "course_allocations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "course_id" uuid NOT NULL,
        "batch_id" uuid,
        "user_id" uuid NOT NULL,
        "start_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "estimated_minutes" integer,
        "due_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" "public"."course_allocations_status_enum" NOT NULL DEFAULT 'ASSIGNED',
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "progress_percent" numeric(5,2) NOT NULL DEFAULT 0,
        CONSTRAINT "PK_course_allocations_id" PRIMARY KEY ("id"),
        CONSTRAINT "chk_ca_due_after_start" CHECK ("due_date" >= "start_date"),
        CONSTRAINT "chk_ca_percent" CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100)
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_ca_one_open_per_course_user" ON "course_allocations" ("course_id", "user_id") WHERE "status" IN ('ASSIGNED', 'IN_PROGRESS') AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ca_user_status" ON "course_allocations" ("user_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ca_course_status" ON "course_allocations" ("course_id", "status")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_ca_due" ON "course_allocations" ("due_date")`);
    await queryRunner.query(`CREATE INDEX "idx_ca_batch" ON "course_allocations" ("batch_id")`);

    await queryRunner.query(`
      ALTER TABLE "course_allocations"
      ADD CONSTRAINT "FK_course_allocations_course_id"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "course_allocations"
      ADD CONSTRAINT "FK_course_allocations_batch_id"
      FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "course_allocations"
      ADD CONSTRAINT "FK_course_allocations_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "assignment_due_overrides" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "course_allocation_id" uuid NOT NULL,
        "assignment_id" uuid NOT NULL,
        "due_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "estimated_minutes" integer,
        "set_by" uuid NOT NULL,
        CONSTRAINT "PK_assignment_due_overrides_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_ado_allocation_assignment" ON "assignment_due_overrides" ("course_allocation_id", "assignment_id") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE "assignment_due_overrides"
      ADD CONSTRAINT "FK_ado_course_allocation_id"
      FOREIGN KEY ("course_allocation_id") REFERENCES "course_allocations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "assignment_due_overrides"
      ADD CONSTRAINT "FK_ado_assignment_id"
      FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "assignment_due_overrides"
      ADD CONSTRAINT "FK_ado_set_by"
      FOREIGN KEY ("set_by") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignment_due_overrides" DROP CONSTRAINT "FK_ado_set_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_due_overrides" DROP CONSTRAINT "FK_ado_assignment_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignment_due_overrides" DROP CONSTRAINT "FK_ado_course_allocation_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_ado_allocation_assignment"`);
    await queryRunner.query(`DROP TABLE "assignment_due_overrides"`);

    await queryRunner.query(
      `ALTER TABLE "course_allocations" DROP CONSTRAINT "FK_course_allocations_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_allocations" DROP CONSTRAINT "FK_course_allocations_batch_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_allocations" DROP CONSTRAINT "FK_course_allocations_course_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_ca_batch"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ca_due"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ca_course_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ca_user_status"`);
    await queryRunner.query(`DROP INDEX "public"."uq_ca_one_open_per_course_user"`);
    await queryRunner.query(`DROP TABLE "course_allocations"`);
    await queryRunner.query(`DROP TYPE "public"."course_allocations_status_enum"`);
  }
}
