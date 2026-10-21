import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1792420000000 implements MigrationInterface {
  name = 'CreateAuditLogsTable1792420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_type_enum" AS ENUM('AUTH', 'USER', 'COURSE', 'BATCH', 'COURSE_ALLOCATION', 'SUBMISSION', 'GRADING')`,
    );

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actor_id" uuid,
        "type" "public"."audit_logs_type_enum" NOT NULL,
        "entity" character varying(100) NOT NULL,
        "entity_id" uuid,
        "action" character varying(100) NOT NULL,
        "old_value" jsonb,
        "new_value" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_actor_id" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_audit_type" ON "audit_logs" ("type")`);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_entity" ON "audit_logs" ("entity", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_actor_time" ON "audit_logs" ("actor_id", "created_at")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_audit_time" ON "audit_logs" ("created_at" DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_audit_time"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_actor_time"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_entity"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_type"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "public"."audit_logs_type_enum"`);
  }
}
