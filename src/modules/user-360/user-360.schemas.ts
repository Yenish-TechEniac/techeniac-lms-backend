import { z } from 'zod';

import { UserRole } from '../users';

export const user360TabEnum = z.enum([
  'all',
  'profile',
  'role-history',
  'batch-history',
  'mentor-mapping-history',
  'course-history',
  'assignment-grade-history',
  'performance-summary',
  'audit',
]);

export type User360Tab = z.infer<typeof user360TabEnum>;

export const user360QuerySchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'User ID must be a valid UUID' }),
  }),
  query: z.object({
    rolePeriod: z.nativeEnum(UserRole).optional(),
    batchId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    auditType: z.string().optional(),
    tab: user360TabEnum.default('all'),
  }),
});

export type User360QueryParams = z.infer<typeof user360QuerySchema>['query'];

export const user360ExportSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'User ID must be a valid UUID' }),
  }),
  query: z.object({
    format: z.enum(['csv', 'pdf']).default('csv'),
    rolePeriod: z.nativeEnum(UserRole).optional(),
    batchId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    auditType: z.string().optional(),
    tab: user360TabEnum.optional(),
  }),
});

export type User360ExportParams = z.infer<typeof user360ExportSchema>['query'];
