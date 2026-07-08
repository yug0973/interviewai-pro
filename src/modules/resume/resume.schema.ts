import { z } from 'zod';

/**
 * Multipart form fields arrive as strings on req.body even for booleans,
 * so this coerces the way multer + our validate() middleware hand them off.
 */
export const uploadResumeSchema = z.object({
  body: z.object({
    label: z.string().trim().min(1).max(100).optional(),
    targetRole: z.string().trim().min(1).max(100).optional(),
    isPrimary: z
      .union([z.boolean(), z.string()])
      .transform((v) => (typeof v === 'string' ? v === 'true' : v))
      .optional(),
  }),
});

export const resumeIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid resume id'),
  }),
});

export const compareResumesSchema = z.object({
  query: z.object({
    a: z.string().uuid('Invalid resume id for "a"'),
    b: z.string().uuid('Invalid resume id for "b"'),
  }),
});

export type UploadResumeInput = z.infer<typeof uploadResumeSchema>['body'];
