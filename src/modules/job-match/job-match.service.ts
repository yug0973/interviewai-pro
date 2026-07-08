import { resumeRepository } from '../resume/resume.repository';
import { aiProvider } from '../../integrations/ai/ai.factory';
import { AIProviderError } from '../../integrations/ai/types';
import { AppError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';
import type { MatchJobDescriptionInput } from './job-match.schema';

async function callAI<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AIProviderError) {
      logger.error('AI call failed during job description match', {
        operation: err.operation,
        provider: err.provider,
        retryable: err.retryable,
        message: err.message,
      });
      throw AppError.serviceUnavailable(
        'The AI matching service is temporarily unavailable. Please try again in a moment.',
        'AI_UNAVAILABLE'
      );
    }
    throw err;
  }
}

export const jobMatchService = {
  async match(userId: string, input: MatchJobDescriptionInput) {
    let resumeText = input.resumeText;
    let targetRole = input.targetRole;

    if (input.resumeId) {
      const resume = await resumeRepository.findByIdForUser(input.resumeId, userId);
      if (!resume) {
        throw AppError.notFound('Resume not found', 'RESUME_NOT_FOUND');
      }
      if (!resume.extractedText) {
        throw AppError.badRequest('Resume text is not available for analysis yet.', 'RESUME_TEXT_MISSING');
      }
      resumeText = resume.extractedText;
      targetRole ??= resume.analysis?.detectedRole ?? resume.targetRole ?? undefined;
    }

    if (!resumeText) {
      throw AppError.badRequest('No resume content provided to compare against the job description.', 'RESUME_TEXT_REQUIRED');
    }

    const result = await callAI(() =>
      aiProvider.matchJobDescription({
        resumeText,
        jobDescriptionText: input.jobDescriptionText,
        targetRole,
      })
    );

    logger.info('Job description matched successfully', {
      userId,
      matchScore: result.data.matchScore,
      roleTitle: result.data.roleTitle,
    });

    return { match: result.data };
  },
};
