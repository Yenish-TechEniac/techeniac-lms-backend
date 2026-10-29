import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { logAudit } from '../../src/core/audit';
import {
  AuditLog,
  type AuditRepository,
  auditRepository,
  AuditService,
  AuditType,
} from '../../src/modules/audit';

void describe('Module 14: Audit Service Unit Tests (AUD-01 to AUD-05)', () => {
  let auditService: AuditService;
  let mockRepository: Partial<AuditRepository>;

  const sampleAuditLogs: AuditLog[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      actorId: 'admin-id',
      type: AuditType.USER,
      entity: 'User',
      entityId: 'mentee-id',
      action: 'ROLE_CHANGE',
      oldValue: { role: 'MENTEE' },
      newValue: { role: 'MENTOR', reason: 'Promotion' },
      createdAt: new Date('2026-03-01T10:00:00Z'),
    } as AuditLog,
    {
      id: '22222222-2222-4222-8222-222222222222',
      actorId: 'admin-id',
      type: AuditType.COURSE,
      entity: 'Course',
      entityId: 'course-id',
      action: 'LIVE_EDIT',
      oldValue: { title: 'Old Title' },
      newValue: { title: 'New Title' },
      createdAt: new Date('2026-03-01T11:00:00Z'),
    } as AuditLog,
  ];

  beforeEach(() => {
    mockRepository = {
      findWithFilters: () => {
        return Promise.resolve({
          items: sampleAuditLogs,
          total: 2,
        });
      },
    };
    auditService = new AuditService(mockRepository as AuditRepository);
  });

  void it('returns audit logs and default pagination (page=1, limit=20)', async () => {
    const result = await auditService.getAuditLogs({ page: 1, limit: 20 });

    assert.equal(result.items.length, 2);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.limit, 20);
    assert.equal(result.pagination.total, 2);
    assert.equal(result.pagination.totalPages, 1);
  });

  void it('clamps limit to maximum of 100', async () => {
    let capturedLimit = 0;
    mockRepository.findWithFilters = (params) => {
      capturedLimit = params.limit;
      return Promise.resolve({ items: [], total: 0 });
    };

    await auditService.getAuditLogs({ page: 1, limit: 500 });
    assert.equal(capturedLimit, 100);
  });

  void it('clamps limit to minimum of 1 when zero or negative', async () => {
    let capturedLimit = 0;
    mockRepository.findWithFilters = (params) => {
      capturedLimit = params.limit;
      return Promise.resolve({ items: [], total: 0 });
    };

    await auditService.getAuditLogs({ page: 1, limit: -5 });
    assert.equal(capturedLimit, 1);
  });

  void it('computes totalPages accurately when total exceeds limit', async () => {
    mockRepository.findWithFilters = () => {
      return Promise.resolve({ items: sampleAuditLogs, total: 45 });
    };

    const result = await auditService.getAuditLogs({ page: 2, limit: 10 });
    assert.equal(result.pagination.totalPages, 5);
    assert.equal(result.pagination.page, 2);
    assert.equal(result.pagination.limit, 10);
  });

  void it('forwards type and action filters to repository', async () => {
    let receivedType: string | undefined;
    let receivedAction: string | undefined;

    mockRepository.findWithFilters = (params) => {
      receivedType = params.type;
      receivedAction = params.action;
      return Promise.resolve({ items: [sampleAuditLogs[0] as AuditLog], total: 1 });
    };

    const result = await auditService.getAuditLogs({
      page: 1,
      limit: 20,
      type: AuditType.USER,
      action: 'ROLE_CHANGE',
    });

    assert.equal(receivedType, AuditType.USER);
    assert.equal(receivedAction, 'ROLE_CHANGE');
    assert.equal(result.items.length, 1);
  });

  void it('logAudit catches errors and returns null without crashing callers', async () => {
    const origCreate = auditRepository.create.bind(auditRepository);
    auditRepository.create = () => {
      return Promise.reject(new Error('Database connection failed'));
    };

    try {
      const outcome = await logAudit({
        type: AuditType.AUTH,
        entity: 'User',
        action: 'LOGIN',
      });
      assert.equal(outcome, null);
    } finally {
      auditRepository.create = origCreate;
    }
  });
});
