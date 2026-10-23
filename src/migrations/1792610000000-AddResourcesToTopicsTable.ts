import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResourcesToTopicsTable1792610000000 implements MigrationInterface {
  name = 'AddResourcesToTopicsTable1792610000000';

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
