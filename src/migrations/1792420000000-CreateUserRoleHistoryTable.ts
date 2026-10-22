import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserRoleHistoryTable1792420000000 implements MigrationInterface {
  name = 'CreateUserRoleHistoryTable1792420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_role_history" (
        "id" uuid DEFAULT gen_random_uuid() NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "user_id" uuid NOT NULL,
        "role" character varying(20) NOT NULL,
        "from_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "to_at" TIMESTAMP WITH TIME ZONE,
        "changed_by" uuid,
        "reason" character varying(500) NOT NULL,
        CONSTRAINT "PK_user_role_history_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_role_history_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_role_history_active" ON "user_role_history" ("user_id")
      WHERE ((to_at IS NULL) AND (deleted_at IS NULL));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_role_history_active";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_role_history";`);
  }
}
