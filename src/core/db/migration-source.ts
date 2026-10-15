import 'reflect-metadata';

import path from 'node:path';

import { DataSource } from 'typeorm';

import { config } from '../config';

export const MigrationDataSource = new DataSource({
  type: 'postgres',
  url: config.DIRECT_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  synchronize: false,
  logging: true,
  entities: [path.join(__dirname, '../../modules/**/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '../../migrations/*.{ts,js}')],
});

export default MigrationDataSource;
