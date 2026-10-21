import { AuditLog, auditRepository, type CreateAuditLogData } from '../../modules/audit';
import { logger } from '../logging';

export type LogAuditParams = CreateAuditLogData;

export async function logAudit(params: LogAuditParams): Promise<AuditLog | null> {
  try {
    return await auditRepository.create(params);
  } catch (error) {
    logger.error({ error, params }, 'Failed to record audit log entry');
    return null;
  }
}
