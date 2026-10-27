import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourseBuilderTables1792650000000 implements MigrationInterface {
  name = 'CreateCourseBuilderTables1792650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "courses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "title" character varying(150) NOT NULL,
        "description" text,
        "estimated_minutes" integer,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_3f70a487cb024d81972a5f809a8" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_courses_active_creator" ON "courses" ("is_active", "created_by")`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "topics" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "course_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "description" text,
        "resources" jsonb,
        "display_order" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "estimated_minutes" integer,
        CONSTRAINT "PK_8de3f8d993e5071e6212e69f8c6" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_topics_course_order" ON "topics" ("course_id", "display_order")`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "subtopics" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "topic_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "content" text,
        "resources" jsonb,
        "display_order" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "estimated_minutes" integer,
        CONSTRAINT "PK_c624d7862f1c070c79eb46d84d1" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_subtopics_topic_order" ON "subtopics" ("topic_id", "display_order")`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "assignments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        "course_id" uuid NOT NULL,
        "topic_id" uuid,
        "scope" character varying(20) NOT NULL,
        "display_order" integer NOT NULL,
        "title" character varying(150) NOT NULL,
        "instructions" text,
        "estimated_minutes" integer NOT NULL,
        "max_marks" numeric(8,2) NOT NULL,
        "pass_marks" numeric(8,2) NOT NULL,
        "allow_late" boolean NOT NULL DEFAULT false,
        "pdf_mode" character varying(20) NOT NULL DEFAULT 'OFF',
        "zip_mode" character varying(20) NOT NULL DEFAULT 'OFF',
        "url_mode" character varying(20) NOT NULL DEFAULT 'OFF',
        "resources" jsonb,
        CONSTRAINT "chk_assign_one_mode_on" CHECK (pdf_mode <> 'OFF' OR zip_mode <> 'OFF' OR url_mode <> 'OFF'),
        CONSTRAINT "chk_assign_pass_le_max" CHECK (pass_marks <= max_marks),
        CONSTRAINT "chk_assign_max_range" CHECK (max_marks > 0 AND max_marks <= 1000),
        CONSTRAINT "chk_assign_scope_topic" CHECK ((scope = 'TOPIC' AND topic_id IS NOT NULL) OR (scope = 'COURSE' AND topic_id IS NULL)),
        CONSTRAINT "PK_4b80ae18a5624707e76cb405788" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_assignments_course_scope" ON "assignments" ("course_id", "scope", "topic_id", "display_order")`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_16fcd8ab8bc042688984d5b3934') THEN
          ALTER TABLE "courses" ADD CONSTRAINT "FK_16fcd8ab8bc042688984d5b3934" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ef19a29ccdfb8903f09e924b66c') THEN
          ALTER TABLE "topics" ADD CONSTRAINT "FK_ef19a29ccdfb8903f09e924b66c" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_14e43cb8c5dbee90087dd8f91ca') THEN
          ALTER TABLE "subtopics" ADD CONSTRAINT "FK_14e43cb8c5dbee90087dd8f91ca" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_33f833f305070d2d4e6305d8a0c') THEN
          ALTER TABLE "assignments" ADD CONSTRAINT "FK_33f833f305070d2d4e6305d8a0c" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_37b452f4e7d9b5fd17581999c6c') THEN
          ALTER TABLE "assignments" ADD CONSTRAINT "FK_37b452f4e7d9b5fd17581999c6c" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP CONSTRAINT IF EXISTS "FK_37b452f4e7d9b5fd17581999c6c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assignments" DROP CONSTRAINT IF EXISTS "FK_33f833f305070d2d4e6305d8a0c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subtopics" DROP CONSTRAINT IF EXISTS "FK_14e43cb8c5dbee90087dd8f91ca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "topics" DROP CONSTRAINT IF EXISTS "FK_ef19a29ccdfb8903f09e924b66c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "FK_16fcd8ab8bc042688984d5b3934"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_assignments_course_scope"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assignments"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_subtopics_topic_order"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subtopics"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_topics_course_order"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "topics"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_courses_active_creator"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courses"`);
  }
}
