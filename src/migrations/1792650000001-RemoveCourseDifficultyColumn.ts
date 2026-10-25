import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCourseDifficultyColumn1792650000001 implements MigrationInterface {
  name = 'RemoveCourseDifficultyColumn1792650000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses" DROP COLUMN IF EXISTS "difficulty";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "difficulty" character varying(50);
    `);
  }
}
