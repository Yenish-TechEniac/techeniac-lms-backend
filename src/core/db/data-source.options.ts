import path from 'node:path';

import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export const baseDataSourceOptions = {
  type: 'postgres',
  uuidExtension: 'pgcrypto',
  synchronize: false,
  migrationsTransactionMode: 'each',
  entities: [path.join(__dirname, '../../modules/**/*.entity.{ts,js}')],
} satisfies Partial<PostgresConnectionOptions>;
