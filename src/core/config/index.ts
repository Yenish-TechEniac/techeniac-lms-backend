import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { logger } from '../logging';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url().startsWith('postgres'),
  DIRECT_URL: z.string().url().startsWith('postgres'),
  TEST_DATABASE_URL: z.string().optional(),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) =>
      val
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url())),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  COMMIT_SHA: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : 'local-dev')),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    logger.error(`Environment configuration validation failed:\n${errorDetails}`);
    process.exit(1);
  }

  logger.level = result.data.LOG_LEVEL;
  return Object.freeze(result.data);
}

export const env = loadEnv();
