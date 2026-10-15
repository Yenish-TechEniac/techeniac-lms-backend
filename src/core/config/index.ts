import dotenv from 'dotenv';

import { logger } from '../logging';
import { AppConfig, envSchema } from './env.schema';

dotenv.config();

function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    logger.error(`Configuration validation failed:\n${errorDetails}`);
    process.exit(1);
  }

  logger.setLevel(result.data.LOG_LEVEL);
  return result.data;
}

export const config = loadConfig();
export type { AppConfig };
