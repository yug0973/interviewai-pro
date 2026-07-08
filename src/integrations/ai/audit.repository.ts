import { prisma } from '../../config/prisma';

export interface AIAuditLogEntry {
  provider: string;
  model: string;
  operation: string;
  success: boolean;
  errorMessage?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  retryAttempt: number;
}

export const aiAuditRepository = {
  async log(entry: AIAuditLogEntry): Promise<void> {
    await prisma.aIRequestLog.create({ data: entry });
  },
};
