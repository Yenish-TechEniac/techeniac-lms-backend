import { DataSource, QueryFailedError } from 'typeorm';

import { logger } from '../logging';
import { AppDataSource } from './data-source';

export { AuditableEntity } from './auditable.entity';
export { BaseEntity } from './base.entity';
export { AppDataSource } from './data-source';

export function isUniqueViolation(err: unknown): boolean {
  if (err instanceof QueryFailedError) {
    const code =
      (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ??
      (err as unknown as { code?: string }).code;
    return code === '23505';
  }
  return false;
}

export async function initializeDatabase(): Promise<DataSource> {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  try {
    const dataSource = await AppDataSource.initialize();
    logger.info('Database connection established successfully via Neon connection pooler');
    return dataSource;
  } catch (err) {
    logger.error({ err }, 'Failed to establish database connection');
    throw err;
  }
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    logger.info('Database connection closed cleanly');
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    if (!AppDataSource.isInitialized) {
      return false;
    }
    await AppDataSource.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
