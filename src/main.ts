import { app } from './app';
import { env } from './core/config';
import { closeDatabase, initializeDatabase } from './core/db';
import { logger } from './core/logging';

export async function bootstrap(): Promise<void> {
  try {
    await initializeDatabase();

    const server = app.listen(env.PORT, () => {
      logger.info(
        `Server running in ${env.NODE_ENV} mode on port ${env.PORT} (http://localhost:${env.PORT})`,
      );
    });

    const shutdown = (signal: string): void => {
      logger.info(`Received ${signal}. Initiating graceful shutdown...`);

      server.close(() => {
        logger.info('HTTP server closed.');
        void closeDatabase()
          .then(() => {
            logger.info('Graceful shutdown completed successfully.');
            process.exit(0);
          })
          .catch((err) => {
            logger.error('Error closing database during shutdown', {
              error: err instanceof Error ? err.message : String(err),
            });
            process.exit(1);
          });
      });

      setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing process termination.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGINT', () => {
      shutdown('SIGINT');
    });

    process.on('SIGTERM', () => {
      shutdown('SIGTERM');
    });
  } catch (error) {
    logger.error('Application bootstrap failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

void bootstrap();
