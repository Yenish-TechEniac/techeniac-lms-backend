import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1792650500000 implements MigrationInterface {
  name = 'CreateAuditLogsTable1792650500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_logs_type_enum') THEN
          CREATE TYPE "public"."audit_logs_type_enum" AS ENUM(
            'AUTH',
            'USER',
            'MENTOR_MAPPING',
            'COURSE',
            'BATCH',
            'COURSE_ALLOCATION',
            'SUBMISSION',
            'GRADING'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."audit_logs_type_enum" ADD VALUE IF NOT EXISTS 'MENTOR_MAPPING';
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actor_id" uuid,
        "type" "public"."audit_logs_type_enum" NOT NULL,
        "entity" character varying(100) NOT NULL,
        "entity_id" uuid,
        "action" character varying(100) NOT NULL,
        "old_value" jsonb,
        "new_value" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )
    `);

    // Ensure FK exists safely
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_audit_logs_actor_id'
        ) THEN
          ALTER TABLE "audit_logs" 
          ADD CONSTRAINT "FK_audit_logs_actor_id" 
          FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_type_time" ON "audit_logs" ("type", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_entity" ON "audit_logs" ("entity", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_actor_time" ON "audit_logs" ("actor_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_time" ON "audit_logs" ("created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_audit_time"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_audit_actor_time"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_audit_entity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_audit_type_time"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_audit_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."audit_logs_type_enum"`);
  }
}
