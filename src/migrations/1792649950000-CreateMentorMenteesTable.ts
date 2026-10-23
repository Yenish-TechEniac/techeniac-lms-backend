import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMentorMenteesTable1792649950000 implements MigrationInterface {
  name = 'CreateMentorMenteesTable1792649950000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "mentor_mentees" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "batch_id" uuid NOT NULL,
        "mentor_id" uuid NOT NULL,
        "mentee_id" uuid NOT NULL,
        "start_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "end_date" TIMESTAMP WITH TIME ZONE,
        "is_active" boolean NOT NULL DEFAULT true,
        "end_reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_mentor_mentees_id" PRIMARY KEY ("id"),
        CONSTRAINT "chk_mm_not_self" CHECK ("mentor_id" <> "mentee_id"),
        CONSTRAINT "FK_mentor_mentees_batch_id" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_mentor_mentees_mentor_id" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_mentor_mentees_mentee_id" FOREIGN KEY ("mentee_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_mm_one_active_mentor_per_batch" ON "mentor_mentees" ("batch_id", "mentee_id") WHERE "is_active" = true AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_mm_batch_mentor_active" ON "mentor_mentees" ("batch_id", "mentor_id", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_mm_mentee_start" ON "mentor_mentees" ("mentee_id", "start_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_mm_mentee_start"`);
    await queryRunner.query(`DROP INDEX "public"."idx_mm_batch_mentor_active"`);
    await queryRunner.query(`DROP INDEX "public"."uq_mm_one_active_mentor_per_batch"`);
    await queryRunner.query(`DROP TABLE "mentor_mentees"`);
  }
}
