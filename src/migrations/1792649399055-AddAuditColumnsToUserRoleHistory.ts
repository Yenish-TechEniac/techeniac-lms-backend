import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditColumnsToUserRoleHistory1792649399055 implements MigrationInterface {
  name = 'AddAuditColumnsToUserRoleHistory1792649399055';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_role_history" ADD COLUMN IF NOT EXISTS "created_by" uuid;`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role_history" ADD COLUMN IF NOT EXISTS "updated_by" uuid;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_role_history" DROP COLUMN IF EXISTS "updated_by";`);
    await queryRunner.query(`ALTER TABLE "user_role_history" DROP COLUMN IF EXISTS "created_by";`);
  }
}
