import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditableColumnsToAuditLogsTable1792650550000 implements MigrationInterface {
  name = 'AddAuditableColumnsToAuditLogsTable1792650550000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "created_by" uuid,
      ADD COLUMN IF NOT EXISTS "updated_by" uuid;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP COLUMN IF EXISTS "updated_by",
      DROP COLUMN IF EXISTS "created_by",
      DROP COLUMN IF EXISTS "deleted_at",
      DROP COLUMN IF EXISTS "updated_at";
    `);
  }
}
