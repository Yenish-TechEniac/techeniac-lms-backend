import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBatchesAndMembersTables1792430000000 implements MigrationInterface {
  name = 'CreateBatchesAndMembersTables1792430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."batches_status_enum" AS ENUM('DRAFT', 'LIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."batch_members_member_role_enum" AS ENUM('MENTOR', 'MENTEE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."batch_members_reason_to_leave_enum" AS ENUM('ROLE_CHANGE', 'BATCH_TRANSFER', 'REMOVED', 'BATCH_COMPLETED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "batches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(100) NOT NULL,
        "code" character varying(20) NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "status" "public"."batches_status_enum" NOT NULL DEFAULT 'DRAFT',
        "description" text,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_batches_id" PRIMARY KEY ("id"),
        CONSTRAINT "chk_batch_dates" CHECK ("start_date" <= "end_date"),
        CONSTRAINT "FK_batches_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "uq_batches_code" ON "batches" ("code")`);
    await queryRunner.query(`CREATE INDEX "idx_batches_status" ON "batches" ("status")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_batches_name_non_archived" ON "batches" ("name") WHERE "status" <> 'ARCHIVED' AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "batch_members" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "batch_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "member_role" "public"."batch_members_member_role_enum" NOT NULL,
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "left_at" TIMESTAMP WITH TIME ZONE,
        "reason_to_leave" "public"."batch_members_reason_to_leave_enum",
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_batch_members_id" PRIMARY KEY ("id"),
        CONSTRAINT "chk_bm_active_left" CHECK (("is_active" = true AND "left_at" IS NULL) OR ("is_active" = false AND "left_at" IS NOT NULL)),
        CONSTRAINT "FK_batch_members_batch_id" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_batch_members_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_bm_one_active_mentee_batch" ON "batch_members" ("user_id") WHERE "member_role" = 'MENTEE' AND "is_active" = true AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_bm_batch_role_active" ON "batch_members" ("batch_id", "member_role", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_bm_user_active" ON "batch_members" ("user_id", "is_active")`,
    );

    await queryRunner.query(`
      CREATE TABLE "batch_status_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "batch_id" uuid NOT NULL,
        "from_status" "public"."batches_status_enum",
        "to_status" "public"."batches_status_enum" NOT NULL,
        "changed_by" uuid NOT NULL,
        "reason" text,
        "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_batch_status_history_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_batch_status_history_batch_id" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_batch_status_history_changed_by" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_bsh_batch_changed" ON "batch_status_history" ("batch_id", "changed_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_bsh_batch_changed"`);
    await queryRunner.query(`DROP TABLE "batch_status_history"`);

    await queryRunner.query(`DROP INDEX "public"."idx_bm_user_active"`);
    await queryRunner.query(`DROP INDEX "public"."idx_bm_batch_role_active"`);
    await queryRunner.query(`DROP INDEX "public"."uq_bm_one_active_mentee_batch"`);
    await queryRunner.query(`DROP TABLE "batch_members"`);

    await queryRunner.query(`DROP INDEX "public"."uq_batches_name_non_archived"`);
    await queryRunner.query(`DROP INDEX "public"."idx_batches_status"`);
    await queryRunner.query(`DROP INDEX "public"."uq_batches_code"`);
    await queryRunner.query(`DROP TABLE "batches"`);

    await queryRunner.query(`DROP TYPE "public"."batch_members_reason_to_leave_enum"`);
    await queryRunner.query(`DROP TYPE "public"."batch_members_member_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."batches_status_enum"`);
  }
}
