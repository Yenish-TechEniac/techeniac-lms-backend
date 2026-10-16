import 'reflect-metadata';

import path from 'node:path';

import { DataSource } from 'typeorm';

import { env } from '../config';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  synchronize: false,
  logging: env.LOG_LEVEL === 'debug',
  entities: [path.join(__dirname, '../../modules/**/*.entity.{ts,js}')],
  extra: {
    max: 10,
    idleTimeoutMillis: 30000,
  },
});
