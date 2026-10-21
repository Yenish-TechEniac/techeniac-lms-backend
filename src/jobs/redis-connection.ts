import type { ConnectionOptions } from 'bullmq';

import { env } from '../core/config';

export const redisConnection: ConnectionOptions = env.REDIS_URL
  ? { url: env.REDIS_URL, maxRetriesPerRequest: null }
  : {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
      maxRetriesPerRequest: null,
    };
