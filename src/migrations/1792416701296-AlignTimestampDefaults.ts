import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignTimestampDefaults1792416701296 implements MigrationInterface {
  name = 'AlignTimestampDefaults1792416701296';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "tokens" ALTER COLUMN "created_at" SET DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "tokens" ALTER COLUMN "updated_at" SET DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "tokens" ALTER COLUMN "issued_at" SET DEFAULT now()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tokens" ALTER COLUMN "issued_at" SET DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP`,
    );
  }
}
