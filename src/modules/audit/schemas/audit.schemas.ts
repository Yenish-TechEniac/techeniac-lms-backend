import { z } from 'zod';

import { AuditType } from '../entities/audit-log.entity';

export const auditTypeSchema = z.nativeEnum(AuditType);

export const getAuditLogsSchema = z.object({
  query: z.object({
    type: auditTypeSchema.optional(),
    actorId: z.string().uuid('Invalid actor ID format').optional(),
    entity: z.string().min(1).max(100).optional(),
    action: z.string().min(1).max(100).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit cannot exceed 100')
      .default(20),
  }),
});

export type AuditQueryParams = z.infer<typeof getAuditLogsSchema>['query'];
