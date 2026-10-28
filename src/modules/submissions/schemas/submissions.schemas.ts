import { z } from 'zod';

export const createSubmissionSchema = z.object({
  body: z.object({
    assignmentId: z.string().uuid({ message: 'assignmentId must be a valid UUID' }),
    courseAllocationId: z
      .string()
      .uuid({ message: 'courseAllocationId must be a valid UUID' })
      .optional(),
    confirmedComplete: z.boolean({
      required_error: 'Please confirm you have completed the assignment',
      invalid_type_error: 'confirmedComplete must be a boolean',
    }),
    submissionData: z
      .object({
        pdfUrl: z.string().trim().optional().nullable(),
        zipUrl: z.string().trim().optional().nullable(),
        linkUrl: z.string().trim().optional().nullable(),
      })
      .transform((data) => ({
        pdfUrl: data.pdfUrl || undefined,
        zipUrl: data.zipUrl || undefined,
        linkUrl: data.linkUrl || undefined,
      }))
      .refine(
        (data) => {
          const hasPdf = Boolean(data.pdfUrl && data.pdfUrl.trim().length > 0);
          const hasZip = Boolean(data.zipUrl && data.zipUrl.trim().length > 0);
          const hasLink = Boolean(data.linkUrl && data.linkUrl.trim().length > 0);
          return hasPdf || hasZip || hasLink;
        },
        {
          message: 'At least one submission field (pdfUrl, zipUrl, or linkUrl) must be provided',
        },
      ),
  }),
});

export const listMyAssignmentsQuerySchema = z.object({
  query: z.object({
    courseId: z.string().uuid().optional(),
    topicId: z.string().uuid().optional(),
    status: z
      .enum(['ALL', 'PENDING', 'SUBMITTED', 'RESUBMIT_REQUESTED', 'GRADED', 'OVERDUE', 'CLOSED'])
      .optional()
      .default('ALL'),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const assignmentIdParamSchema = z.object({
  params: z.object({
    assignmentId: z.string().uuid({ message: 'assignmentId must be a valid UUID' }),
  }),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>['body'];
export type ListMyAssignmentsQuery = z.infer<typeof listMyAssignmentsQuerySchema>['query'];
