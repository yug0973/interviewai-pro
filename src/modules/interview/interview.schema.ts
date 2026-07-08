import { z } from 'zod';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const MODES = ['TEXT', 'VOICE'] as const;
const FOCUS_AREAS = ['mixed', 'dsa', 'backend', 'system_design', 'behavioral', 'frontend', 'devops'] as const;

export const startInterviewSchema = z.object({
  body: z
    .object({
      targetRole: z.string().trim().min(1).max(100).optional(),
      difficulty: z.enum(DIFFICULTIES).optional(),
      resumeId: z.string().uuid().optional(),
      totalQuestions: z.coerce.number().int().min(3).max(15).optional(),
      mode: z.enum(MODES).optional(),
      focus: z.enum(FOCUS_AREAS).optional(),
      topics: z.array(z.string()).optional(),
    })
    .refine((data) => Boolean(data.targetRole) || Boolean(data.resumeId), {
      message: 'Provide either targetRole or resumeId so the interview knows what role to target',
      path: ['targetRole'],
    }),
});

export const submitAnswerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid session id'),
  }),
  body: z.object({
    answerText: z.string().trim().min(1, 'Answer cannot be empty').max(10_000),
  }),
});

export const sessionIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid session id'),
  }),
});

export type StartInterviewInput = z.infer<typeof startInterviewSchema>['body'];
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>['body'];