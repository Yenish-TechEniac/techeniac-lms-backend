import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditColumnsToAuditableTables1792586857155 implements MigrationInterface {
  name = 'AddAuditColumnsToAuditableTables1792586857155';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_by" uuid;`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_by" uuid;`);
    await queryRunner.query(`ALTER TABLE "tokens" ADD COLUMN IF NOT EXISTS "created_by" uuid;`);
    await queryRunner.query(`ALTER TABLE "tokens" ADD COLUMN IF NOT EXISTS "updated_by" uuid;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN IF EXISTS "updated_by";`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN IF EXISTS "created_by";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "updated_by";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "created_by";`);
  }
}
