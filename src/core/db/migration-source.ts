import 'reflect-metadata';

import path from 'node:path';

import { DataSource } from 'typeorm';

import { env } from '../config';
import { baseDataSourceOptions } from './data-source.options';

// TLS is configured by the connection string: Neon → ?sslmode=verify-full, local Postgres → ?sslmode=disable
export const MigrationDataSource = new DataSource({
  ...baseDataSourceOptions,
  url: env.DIRECT_URL,
  logging: true,
  migrations: [path.join(__dirname, '../../migrations/*.{ts,js}')],
});

export default MigrationDataSource;
