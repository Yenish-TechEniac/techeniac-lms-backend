import { AuditLog, AuditLogType } from '../../src/modules/audit';

/**
 * Creates a mock AuditLog entity populated with default values.
 * Allows partial overrides for granular unit and integration test assertions.
 */
export const createMockAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog => {
  const log = new AuditLog();
  Object.assign(
    log,
    {
      id: '00000000-0000-4000-8000-000000000001',
      actorId: null,
      actor: null,
      type: AuditLogType.USER,
      entity: 'User',
      entityId: null,
      action: 'TEST_ACTION',
      oldValue: null,
      newValue: null,
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      updatedAt: new Date('2026-03-01T10:00:00.000Z'),
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
    },
    overrides,
  );
  return log;
};
