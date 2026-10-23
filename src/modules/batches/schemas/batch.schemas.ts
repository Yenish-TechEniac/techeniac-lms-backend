import { z } from 'zod';

import { BatchMemberRole, BatchStatus } from '../entities/batch.enums';

export const createBatchSchema = z.object({
  body: z
    .object({
      name: z
        .string({ required_error: 'Batch name is required' })
        .trim()
        .min(3, 'Batch name must be at least 3 characters')
        .max(100, 'Batch name must not exceed 100 characters'),
      code: z
        .string({ required_error: 'Batch code is required' })
        .trim()
        .min(3, 'Batch code must be at least 3 characters')
        .max(20, 'Batch code must not exceed 20 characters')
        .regex(
          /^[A-Z0-9-]+$/,
          'Batch code must contain only uppercase alphanumeric characters and hyphens',
        ),
      startDate: z
        .string({ required_error: 'Start date is required' })
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
      endDate: z
        .string({ required_error: 'End date is required' })
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
      description: z
        .string()
        .max(5000, 'Description must not exceed 5000 characters')
        .optional()
        .nullable(),
    })
    .refine(
      (data) => {
        return new Date(data.startDate) <= new Date(data.endDate);
      },
      {
        message: 'Start date must be before or equal to end date',
        path: ['endDate'],
      },
    ),
});

export const getBatchByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid batch ID'),
  }),
});

export const updateBatchSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid batch ID'),
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(3, 'Batch name must be at least 3 characters')
      .max(100, 'Batch name must not exceed 100 characters')
      .optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
      .optional(),
    description: z
      .string()
      .max(5000, 'Description must not exceed 5000 characters')
      .optional()
      .nullable(),
  }),
});

export const changeBatchStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid batch ID'),
  }),
  body: z.object({
    toStatus: z.nativeEnum(BatchStatus, {
      errorMap: () => ({ message: 'Invalid batch status' }),
    }),
    reason: z.string().max(500, 'Reason must not exceed 500 characters').optional().nullable(),
  }),
});

export const addBatchMembersSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid batch ID'),
  }),
  body: z.object({
    userIds: z
      .array(z.string().uuid('Each user ID must be a valid UUID'))
      .min(1, 'At least one user must be specified'),
    memberRole: z.nativeEnum(BatchMemberRole, {
      errorMap: () => ({ message: 'Invalid member role' }),
    }),
  }),
});

export const removeBatchMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid batch ID'),
    userId: z.string().uuid('Invalid user ID'),
  }),
});

export const transferMenteeSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid source batch ID'),
  }),
  body: z.object({
    menteeId: z.string().uuid('Invalid mentee ID'),
    targetBatchId: z.string().uuid('Invalid target batch ID'),
    reason: z.string().max(500, 'Reason must not exceed 500 characters').optional().nullable(),
  }),
});

export const batchQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(100).optional(),
    status: z.nativeEnum(BatchStatus).optional(),
  }),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>['body'];
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>['body'];
export type ChangeBatchStatusInput = z.infer<typeof changeBatchStatusSchema>['body'];
export type AddBatchMembersInput = z.infer<typeof addBatchMembersSchema>['body'];
export type TransferMenteeInput = z.infer<typeof transferMenteeSchema>['body'];
export type BatchQueryParams = z.infer<typeof batchQuerySchema>['query'];
