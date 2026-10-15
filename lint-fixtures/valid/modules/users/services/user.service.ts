import { logger } from '../../../../../src/core/logging';

export function findUserById(id: string): string {
  logger.info('Finding user', { id });
  return id;
}

