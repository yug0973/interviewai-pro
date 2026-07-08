import { Queue } from 'bullmq';
import { createBullConnection } from './connection';

export const RESUME_ANALYSIS_QUEUE_NAME = 'resume-analysis';

export interface ResumeAnalysisJobData {
  resumeId: string;
  /**
   * Present only when the upload request's fast-path extraction found no
   * usable text layer (scanned/image PDF). The worker OCRs this buffer in
   * the background before running AI analysis, instead of the old behavior
   * of OCRing inline during the upload request (which is what made uploads
   * of scanned resumes feel like they hung).
   */
  ocr?: {
    bufferBase64: string;
  };
}

let queue: Queue<ResumeAnalysisJobData> | undefined;

/**
 * Constructed lazily rather than at module load. BullMQ's Queue constructor
 * proactively opens a Redis connection to check server compatibility, so
 * eagerly instantiating it at import time would mean merely importing the
 * resume module (e.g. transitively through app.ts) tries to reach Redis -
 * breaking any test or code path that never actually uploads a resume.
 */
function getResumeAnalysisQueue(): Queue<ResumeAnalysisJobData> {
  if (!queue) {
    queue = new Queue<ResumeAnalysisJobData>(RESUME_ANALYSIS_QUEUE_NAME, {
      connection: createBullConnection(),
      defaultJobOptions: {
        // The AI layer's InstrumentedAIProvider already retries transient failures
        // internally (see integrations/ai/instrumented-provider.ts), so this is a
        // thin outer safety net for infra-level failures (e.g. a worker crash
        // mid-job), not a duplicate of the AI retry logic.
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 60 * 60 * 24 * 7 }, // 7 days
        removeOnFail: { age: 60 * 60 * 24 * 30 }, // 30 days, useful for debugging
      },
    });
  }
  return queue;
}

export async function enqueueResumeAnalysis(
  resumeId: string,
  ocr?: { bufferBase64: string }
): Promise<void> {
  await getResumeAnalysisQueue().add('analyze', { resumeId, ocr });
}