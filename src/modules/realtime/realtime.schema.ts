import { z } from 'zod';

export const startRealtimeSessionSchema = z.object({
  targetRole: z.string().min(2, 'Target role is required').max(100),
  interviewType: z
    .enum(['technical', 'behavioral', 'system_design', 'mixed', 'coding', 'hr'])
    .default('technical'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  resumeId: z.string().uuid().optional(),
  jobDescriptionText: z.string().max(10000).optional(),
});

export type StartRealtimeSessionInput = z.infer<typeof startRealtimeSessionSchema>;
