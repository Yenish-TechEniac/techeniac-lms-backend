import 'reflect-metadata';

import path from 'node:path';

import { DataSource } from 'typeorm';

import { config } from '../config';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: config.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  synchronize: false,
  logging: config.LOG_LEVEL === 'debug',
  entities: [path.join(__dirname, '../../modules/**/*.entity.{ts,js}')],
  extra: {
    max: 10,
    idleTimeoutMillis: 30000,
  },
});
