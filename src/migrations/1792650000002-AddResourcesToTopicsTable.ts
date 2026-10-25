import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResourcesToTopicsTable1792650000002 implements MigrationInterface {
  name = 'AddResourcesToTopicsTable1792650000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "resources" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "topics" DROP COLUMN IF EXISTS "resources";
    `);
  }
}
