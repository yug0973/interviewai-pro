import { z } from 'zod';

export const matchJobDescriptionSchema = z.object({
  body: z.object({
    resumeId: z.string().uuid().optional(),
    resumeText: z.string().trim().min(50).max(50_000).optional(),
    jobDescriptionText: z.string().trim().min(50, 'Job description must be at least 50 characters').max(50_000),
    targetRole: z.string().trim().min(1).max(100).optional(),
  }).refine((data) => Boolean(data.resumeId) || Boolean(data.resumeText), {
    message: 'Provide either resumeId (for an uploaded resume) or raw resumeText',
    path: ['resumeId'],
  }),
});

export type MatchJobDescriptionInput = z.infer<typeof matchJobDescriptionSchema>['body'];
