import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(200).optional(),
    plan: z.enum(['FREE', 'PRO']).optional(),
    role: z.enum(['CANDIDATE', 'ADMIN']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user id'),
  }),
});

export const changeRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user id'),
  }),
  body: z.object({
    role: z.enum(['CANDIDATE', 'ADMIN']),
  }),
});

export const listOrdersQuerySchema = z.object({
  query: z.object({
    status: z.enum(['CREATED', 'PAID', 'FAILED']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const createFlagSchema = z.object({
  body: z.object({
    type: z.enum(['RESUME', 'INTERVIEW_SESSION']),
    targetId: z.string().uuid('Invalid target id'),
    reason: z.string().trim().min(1).max(2000),
  }),
});

export const listFlagsQuerySchema = z.object({
  query: z.object({
    status: z.enum(['OPEN', 'RESOLVED']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const flagIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid flag id'),
  }),
});

export const resolveFlagSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid flag id'),
  }),
  body: z.object({
    resolutionNote: z.string().trim().min(1).max(2000),
  }),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>['query'];
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>['body'];
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>['query'];
export type CreateFlagInput = z.infer<typeof createFlagSchema>['body'];
export type ListFlagsQuery = z.infer<typeof listFlagsQuerySchema>['query'];
export type ResolveFlagInput = z.infer<typeof resolveFlagSchema>['body'];