import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndTokensTables1792649722675 implements MigrationInterface {
  name = 'CreateUsersAndTokensTables1792649722675';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('SUPER_ADMIN', 'MENTOR', 'MENTEE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "name" character varying(100) NOT NULL, "email" character varying(254) NOT NULL, "password_hash" text NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'MENTEE', "token_version" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "must_change_password" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email") `);
    await queryRunner.query(
      `CREATE INDEX "idx_users_role_active" ON "users" ("role", "is_active") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tokens_token_type_enum" AS ENUM('REFRESH', 'PASSWORD_RESET')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tokens_revoked_reason_enum" AS ENUM('LOGOUT', 'ROTATED', 'REUSE_DETECTED', 'PASSWORD_CHANGED', 'PASSWORD_RESET', 'ROLE_CHANGED', 'DEACTIVATED', 'ADMIN_REVOKED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "updated_by" uuid, "user_id" uuid NOT NULL, "token_type" "public"."tokens_token_type_enum" NOT NULL, "jti" uuid NOT NULL, "family_id" uuid, "replaced_by_id" uuid, "token_version" integer, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "password_reset_used_at" TIMESTAMP WITH TIME ZONE, "last_refreshed_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_reason" "public"."tokens_revoked_reason_enum", CONSTRAINT "chk_tokens_reset_used_only" CHECK (token_type = 'PASSWORD_RESET' OR password_reset_used_at IS NULL), CONSTRAINT "chk_tokens_refresh_family" CHECK (token_type <> 'REFRESH' OR family_id IS NOT NULL), CONSTRAINT "chk_tokens_version_required" CHECK (token_type = 'PASSWORD_RESET' OR token_version IS NOT NULL), CONSTRAINT "chk_tokens_revoked_pair" CHECK ((revoked_at IS NULL AND revoked_reason IS NULL) OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL)), CONSTRAINT "chk_tokens_expiry" CHECK (expires_at > issued_at), CONSTRAINT "PK_3001e89ada36263dabf1fb6210a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_tokens_jti" ON "tokens" ("jti") `);
    await queryRunner.query(`CREATE INDEX "idx_tokens_expires" ON "tokens" ("expires_at") `);
    await queryRunner.query(`CREATE INDEX "idx_tokens_family" ON "tokens" ("family_id") `);
    await queryRunner.query(
      `CREATE INDEX "idx_tokens_user_type_revoked" ON "tokens" ("user_id", "token_type", "revoked_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD CONSTRAINT "FK_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD CONSTRAINT "FK_tokens_replaced_by_id" FOREIGN KEY ("replaced_by_id") REFERENCES "tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT "FK_tokens_replaced_by_id"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT "FK_tokens_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tokens_user_type_revoked"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tokens_family"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tokens_expires"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tokens_jti"`);
    await queryRunner.query(`DROP TABLE "tokens"`);
    await queryRunner.query(`DROP TYPE "public"."tokens_revoked_reason_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tokens_token_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."idx_users_role_active"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
