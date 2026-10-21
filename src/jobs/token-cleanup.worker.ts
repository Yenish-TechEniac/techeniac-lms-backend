import { type Job, Worker } from 'bullmq';

import { logger } from '../core/logging';
import { tokenRepository } from '../modules/auth';
import { redisConnection } from './redis-connection';

export const TOKEN_CLEANUP_QUEUE_NAME = 'token-cleanup';

export function createTokenCleanupWorker(): Worker {
  const worker = new Worker(
    TOKEN_CLEANUP_QUEUE_NAME,
    async (job: Job) => {
      logger.info({ jobId: job.id }, 'Processing expired token cleanup job');
      const affectedCount = await tokenRepository.cleanupExpiredTokens();
      logger.info(
        { jobId: job.id, affectedCount },
        'Expired token cleanup job completed successfully',
      );
      return { affectedCount };
    },
    {
      connection: redisConnection,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Token cleanup worker encountered job failure');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Token cleanup worker encountered internal error');
  });

  return worker;
}
