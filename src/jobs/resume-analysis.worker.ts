import { Worker, Job } from 'bullmq';
import { createBullConnection } from './connection';
import { RESUME_ANALYSIS_QUEUE_NAME, type ResumeAnalysisJobData } from './resume-analysis.queue';
import { resumeRepository } from '../modules/resume/resume.repository';
import { ocrPdf } from '../modules/resume/resume.extraction';
import { aiProvider } from '../integrations/ai/ai.factory';
import { logger } from '../common/logger';

/**
 * Only this worker ever calls aiProvider.analyzeResume() - the upload
 * request handler returns 202 immediately and never touches the AI layer
 * directly. Errors here mark the resume FAILED rather than throwing past
 * BullMQ's retry budget silently swallowing the reason.
 */
async function processResumeAnalysisJob(job: Job<ResumeAnalysisJobData>) {
  const { resumeId, ocr } = job.data;

  const resume = await resumeRepository.findById(resumeId);
  if (!resume) {
    logger.error('Resume analysis job references a resume that no longer exists', { resumeId });
    return; // nothing to retry - the resume was deleted
  }

  let extractedText = resume.extractedText;

  // Scanned/image-only PDF: the upload request's fast path deliberately
  // skipped OCR (too slow to run inline in an HTTP request) and left
  // extractedText null. Run it here instead, in the background.
  if (ocr && !extractedText) {
    try {
      const buffer = Buffer.from(ocr.bufferBase64, 'base64');
      extractedText = await ocrPdf(buffer);
      await resumeRepository.updateExtractedText(resumeId, extractedText);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR failed';
      logger.error('Background OCR failed', { resumeId, err: message });
      await resumeRepository.updateStatus(resumeId, 'FAILED', message);
      return; // don't retry via BullMQ - OCR failing again won't fix itself
    }
  }

  if (!extractedText) {
    await resumeRepository.updateStatus(resumeId, 'FAILED', 'No extracted text available to analyze');
    return;
  }

  try {
    const result = await aiProvider.analyzeResume({
      resumeText: extractedText,
      targetRole: resume.targetRole ?? undefined,
    });

    await resumeRepository.createAnalysis(resumeId, result.data, {
      provider: result.provider,
      model: result.model,
      costUsd: result.costUsd,
    });
    await resumeRepository.updateStatus(resumeId, 'COMPLETED');

    logger.info('Resume analysis completed', { resumeId, atsScore: result.data.atsScore });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during AI analysis';
    logger.error('Resume analysis failed', { resumeId, err: message });
    await resumeRepository.updateStatus(resumeId, 'FAILED', message);
    throw err; // let BullMQ's configured retry/backoff decide whether to try again
  }
}

export function startResumeAnalysisWorker(): Worker<ResumeAnalysisJobData> {
  const worker = new Worker<ResumeAnalysisJobData>(
    RESUME_ANALYSIS_QUEUE_NAME,
    processResumeAnalysisJob,
    { connection: createBullConnection(), concurrency: 3 }
  );

  worker.on('failed', (job, err) => {
    logger.error('Resume analysis job failed permanently', {
      jobId: job?.id,
      resumeId: job?.data.resumeId,
      err: err.message,
    });
  });

  return worker;
}