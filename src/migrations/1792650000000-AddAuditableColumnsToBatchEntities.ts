import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditableColumnsToBatchEntities1792650000000 implements MigrationInterface {
  name = 'AddAuditableColumnsToBatchEntities1792650000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. batches: add updated_by and align created_by nullability with AuditableEntity
    await queryRunner.query(`ALTER TABLE "batches" ADD "updated_by" uuid`);
    await queryRunner.query(`ALTER TABLE "batches" ALTER COLUMN "created_by" DROP NOT NULL`);

    // 2. batch_members: add created_by, updated_by
    await queryRunner.query(`ALTER TABLE "batch_members" ADD "created_by" uuid`);
    await queryRunner.query(`ALTER TABLE "batch_members" ADD "updated_by" uuid`);

    // 3. batch_status_history: add created_by, updated_by
    await queryRunner.query(`ALTER TABLE "batch_status_history" ADD "created_by" uuid`);
    await queryRunner.query(`ALTER TABLE "batch_status_history" ADD "updated_by" uuid`);

    // 4. mentor_mentees: add created_by, updated_by
    await queryRunner.query(`ALTER TABLE "mentor_mentees" ADD "created_by" uuid`);
    await queryRunner.query(`ALTER TABLE "mentor_mentees" ADD "updated_by" uuid`);

    // 5. Expand batch_members_reason_to_leave_enum
    await queryRunner.query(
      `ALTER TYPE "public"."batch_members_reason_to_leave_enum" ADD VALUE IF NOT EXISTS 'BATCH_ARCHIVED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."batch_members_reason_to_leave_enum" ADD VALUE IF NOT EXISTS 'REASSIGNED'`,
    );

    // 6. mentor_mentees: convert end_reason to enum
    await queryRunner.query(`
      ALTER TABLE "mentor_mentees"
      ALTER COLUMN "end_reason" TYPE "public"."batch_members_reason_to_leave_enum"
      USING (
        CASE
          WHEN "end_reason" = 'MEMBER_REMOVED' THEN 'REMOVED'::"public"."batch_members_reason_to_leave_enum"
          WHEN "end_reason" IN ('ROLE_CHANGE', 'BATCH_TRANSFER', 'REMOVED', 'BATCH_COMPLETED', 'BATCH_ARCHIVED', 'REASSIGNED')
            THEN "end_reason"::"public"."batch_members_reason_to_leave_enum"
          ELSE NULL
        END
      )
    `);

    // 7. batches: case-insensitive unique index on LOWER(name)
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."uq_batches_name_non_archived"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_batches_name_non_archived" ON "batches" (LOWER("name")) WHERE "status" <> 'ARCHIVED' AND "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."uq_batches_name_non_archived"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_batches_name_non_archived" ON "batches" ("name") WHERE "status" <> 'ARCHIVED' AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE "mentor_mentees"
      ALTER COLUMN "end_reason" TYPE text
      USING "end_reason"::text
    `);

    await queryRunner.query(`ALTER TABLE "mentor_mentees" DROP COLUMN "updated_by"`);
    await queryRunner.query(`ALTER TABLE "mentor_mentees" DROP COLUMN "created_by"`);

    await queryRunner.query(`ALTER TABLE "batch_status_history" DROP COLUMN "updated_by"`);
    await queryRunner.query(`ALTER TABLE "batch_status_history" DROP COLUMN "created_by"`);

    await queryRunner.query(`ALTER TABLE "batch_members" DROP COLUMN "updated_by"`);
    await queryRunner.query(`ALTER TABLE "batch_members" DROP COLUMN "created_by"`);

    await queryRunner.query(`ALTER TABLE "batches" ALTER COLUMN "created_by" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "batches" DROP COLUMN "updated_by"`);
  }
}
