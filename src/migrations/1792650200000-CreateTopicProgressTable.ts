import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTopicProgressTable1792650200000 implements MigrationInterface {
  name = 'CreateTopicProgressTable1792650200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."topic_progress_status_enum" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "topic_progress" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "course_allocation_id" uuid NOT NULL,
        "topic_id" uuid NOT NULL,
        "status" "public"."topic_progress_status_enum" NOT NULL DEFAULT 'NOT_STARTED',
        "deadline" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "note" text,
        CONSTRAINT "PK_c8051cdf2b8d481701e61825c1c" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tp_allocation_topic" ON "topic_progress" ("course_allocation_id", "topic_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tp_allocation_status" ON "topic_progress" ("course_allocation_id", "status")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_tp_topic" ON "topic_progress" ("topic_id")`);
    await queryRunner.query(`CREATE INDEX "idx_tp_deadline" ON "topic_progress" ("deadline")`);

    await queryRunner.query(`
      ALTER TABLE "topic_progress"
      ADD CONSTRAINT "FK_topic_progress_course_allocation_id"
      FOREIGN KEY ("course_allocation_id") REFERENCES "course_allocations"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "topic_progress"
      ADD CONSTRAINT "FK_topic_progress_topic_id"
      FOREIGN KEY ("topic_id") REFERENCES "topics"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "topic_progress" DROP CONSTRAINT "FK_topic_progress_topic_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_progress" DROP CONSTRAINT "FK_topic_progress_course_allocation_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_tp_deadline"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tp_topic"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tp_allocation_status"`);
    await queryRunner.query(`DROP INDEX "public"."uq_tp_allocation_topic"`);
    await queryRunner.query(`DROP TABLE "topic_progress"`);
    await queryRunner.query(`DROP TYPE "public"."topic_progress_status_enum"`);
  }
}
