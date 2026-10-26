import { z } from 'zod';

export const mapMenteesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid batch ID'),
  }),
  body: z.object({
    mentorId: z.string().uuid('Invalid mentor ID'),
    menteeIds: z
      .array(z.string().uuid('Each mentee ID must be a valid UUID'))
      .min(1, 'At least one mentee must be selected'),
  }),
});

export const reassignMenteeSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid batch ID'),
  }),
  body: z.object({
    menteeId: z.string().uuid('Invalid mentee ID'),
    newMentorId: z.string().uuid('Invalid mentor ID'),
    reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional().nullable(),
  }),
});

export const mentorQuerySchema = z.object({
  query: z.object({
    batchId: z.string().uuid('Invalid batch ID').optional(),
  }),
});

export type MapMenteesInput = z.infer<typeof mapMenteesSchema>['body'];
export type ReassignMenteeInput = z.infer<typeof reassignMenteeSchema>['body'];
export type MentorQueryParams = z.infer<typeof mentorQuerySchema>['query'];
