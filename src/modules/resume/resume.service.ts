import { resumeRepository } from './resume.repository';
import { validateResumeFile } from './resume.validation';
import { extractResumeTextFast } from './resume.extraction';
import { uploadResumeFile, deleteResumeFile } from '../../integrations/storage/cloudinary-storage';
import { enqueueResumeAnalysis } from '../../jobs/resume-analysis.queue';
import { authRepository } from '../auth/auth.repository';
import { isProActive } from '../billing/plan.util';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';
import type { UploadResumeInput } from './resume.schema';

export interface UploadedFilePayload {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

/**
 * Free-plan users are capped at env.FREE_RESUME_UPLOADS_PER_MONTH uploads per
 * calendar month; Pro users (active, non-lapsed) bypass this entirely. Kept
 * as a standalone function rather than a shared cross-module gate, since
 * Resume and Interview each count a different resource.
 */
async function assertWithinFreeUploadLimit(userId: string): Promise<void> {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }
  if (isProActive(user)) return;

  const count = await resumeRepository.countResumesThisMonth(userId);
  if (count >= env.FREE_RESUME_UPLOADS_PER_MONTH) {
    throw AppError.forbidden(
      `Free plan allows ${env.FREE_RESUME_UPLOADS_PER_MONTH} resume uploads per month. Upgrade to Pro for unlimited uploads.`,
      'FREE_TIER_LIMIT_REACHED'
    );
  }
}

export const resumeService = {
  /**
   * Full upload pipeline: validate -> extract text (fast path only, never
   * OCR here) -> store the original file -> persist a PROCESSING row ->
   * enqueue analysis (with the raw buffer attached when OCR is needed, so
   * the worker runs OCR in the background instead of the request blocking
   * on it). Returns immediately with a PROCESSING resume either way.
   */
  async uploadResume(userId: string, file: UploadedFilePayload, input: UploadResumeInput) {
    await assertWithinFreeUploadLimit(userId);

    const { mimeType } = validateResumeFile(file);
    const extraction = await extractResumeTextFast(file.buffer, mimeType);

    const uploaded = await uploadResumeFile(file.buffer, userId, file.originalname);

    const resume = await resumeRepository.createResume({
      userId,
      label: input.label ?? file.originalname,
      isPrimary: input.isPrimary ?? false,
      targetRole: input.targetRole,
      originalFilename: file.originalname,
      mimeType,
      fileSizeBytes: file.size,
      cloudinaryPublicId: uploaded.publicId,
      cloudinaryUrl: uploaded.url,
      extractionMethod: extraction.method,
      extractedText: extraction.text ?? undefined,
    });

    if (extraction.method === 'ocr') {
      await enqueueResumeAnalysis(resume.id, { bufferBase64: file.buffer.toString('base64') });
    } else {
      await enqueueResumeAnalysis(resume.id);
    }

    logger.info('Resume uploaded, analysis job enqueued', {
      resumeId: resume.id,
      userId,
      needsBackgroundOcr: extraction.method === 'ocr',
    });

    return resume;
  },

  async listResumes(userId: string) {
    return resumeRepository.findAllForUser(userId);
  },

  async getResume(userId: string, resumeId: string) {
    const resume = await resumeRepository.findByIdForUser(resumeId, userId);
    if (!resume) {
      throw AppError.notFound('Resume not found', 'RESUME_NOT_FOUND');
    }
    return resume;
  },

  async setPrimary(userId: string, resumeId: string) {
    const resume = await resumeRepository.findByIdForUser(resumeId, userId);
    if (!resume) {
      throw AppError.notFound('Resume not found', 'RESUME_NOT_FOUND');
    }
    return resumeRepository.setPrimary(resumeId, userId);
  },

  async deleteResume(userId: string, resumeId: string) {
    const resume = await resumeRepository.findByIdForUser(resumeId, userId);
    if (!resume) {
      throw AppError.notFound('Resume not found', 'RESUME_NOT_FOUND');
    }
    await resumeRepository.delete(resumeId);
    await deleteResumeFile(resume.cloudinaryPublicId);
  },

  /**
   * Side-by-side comparison of two of the caller's own resumes. Computed on
   * the fly from existing rows - no dedicated "comparison" table needed.
   */
  async compareResumes(userId: string, resumeIdA: string, resumeIdB: string) {
    const [a, b] = await Promise.all([
      resumeRepository.findByIdForUser(resumeIdA, userId),
      resumeRepository.findByIdForUser(resumeIdB, userId),
    ]);

    if (!a || !b) {
      throw AppError.notFound('One or both resumes were not found', 'RESUME_NOT_FOUND');
    }

    if (!a.analysis || !b.analysis) {
      throw AppError.badRequest(
        'Both resumes must finish analysis before they can be compared',
        'ANALYSIS_NOT_READY'
      );
    }

    return {
      a: { resume: a, analysis: a.analysis },
      b: { resume: b, analysis: b.analysis },
      atsScoreDelta: a.analysis.atsScore - b.analysis.atsScore,
    };
  },
};