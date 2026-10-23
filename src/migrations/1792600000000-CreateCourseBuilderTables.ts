import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourseBuilderTables1792600000000 implements MigrationInterface {
  name = 'CreateCourseBuilderTables1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. courses table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "title" character varying(150) NOT NULL,
        "description" text,
        "estimated_minutes" integer,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_by" uuid NOT NULL,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_courses_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_courses_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_courses_active_creator" ON "courses" ("is_active", "created_by");
    `);

    // 2. topics table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "topics" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "course_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "description" text,
        "display_order" integer NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "estimated_minutes" integer,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_topics_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_topics_course_id" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_topics_course_order" ON "topics" ("course_id", "display_order");
    `);

    // 3. subtopics table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subtopics" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "topic_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "content" text,
        "resources" jsonb,
        "display_order" integer NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "estimated_minutes" integer,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_subtopics_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subtopics_topic_id" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_subtopics_topic_order" ON "subtopics" ("topic_id", "display_order");
    `);

    // 4. assignments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assignments" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "course_id" uuid NOT NULL,
        "topic_id" uuid,
        "scope" character varying(20) NOT NULL,
        "display_order" integer NOT NULL,
        "title" character varying(150) NOT NULL,
        "instructions" text,
        "estimated_minutes" integer NOT NULL,
        "max_marks" numeric(8,2) NOT NULL,
        "pass_marks" numeric(8,2) NOT NULL,
        "allow_late" boolean DEFAULT false NOT NULL,
        "pdf_mode" character varying(20) DEFAULT 'OFF' NOT NULL,
        "zip_mode" character varying(20) DEFAULT 'OFF' NOT NULL,
        "url_mode" character varying(20) DEFAULT 'OFF' NOT NULL,
        "resources" jsonb,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_assignments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_assignments_course_id" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_assignments_topic_id" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "chk_assign_one_mode_on" CHECK (pdf_mode <> 'OFF' OR zip_mode <> 'OFF' OR url_mode <> 'OFF'),
        CONSTRAINT "chk_assign_pass_le_max" CHECK (pass_marks <= max_marks),
        CONSTRAINT "chk_assign_max_range" CHECK (max_marks > 0 AND max_marks <= 1000),
        CONSTRAINT "chk_assign_scope_topic" CHECK (
          (scope = 'TOPIC' AND topic_id IS NOT NULL) OR 
          (scope = 'COURSE' AND topic_id IS NULL)
        )
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_assignments_course_scope" ON "assignments" ("course_id", "scope", "topic_id", "display_order");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assignments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subtopics";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "topics";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courses";`);
  }
}
