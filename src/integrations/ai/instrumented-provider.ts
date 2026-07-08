import type {
  AIProvider,
  AIResult,
  AIOperation,
  AnalyzeResumeInput,
  ResumeAnalysisResult,
  GenerateQuestionInput,
  InterviewQuestionResult,
  EvaluateAnswerInput,
  AnswerEvaluationResult,
  FollowUpInput,
  SummarizeInterviewInput,
  InterviewSummaryResult,
  GenerateFeedbackInput,
  FeedbackResult,
  MatchJobDescriptionInput,
  JobMatchResult,
  RealtimeAgentTurnInput,
  RealtimeAgentTurnResult,
  RealtimeEvaluationInput,
  RealtimeEvaluationResult,
} from './types';
import { AIProviderError } from './types';
import { enforceAIRateLimit } from './rateLimit';
import { aiAuditRepository } from './audit.repository';
import { logger } from '../../common/logger';

export interface InstrumentationOptions {
  /** Fallback timeout for any AIOperation not listed in operationTimeoutsMs. */
  timeoutMs: number;
  /**
   * Per-operation timeout overrides. Interactive, per-turn operations
   * run synchronously inside an HTTP request and need to fail fast.
   */
  operationTimeoutsMs?: Partial<Record<AIOperation, number>>;
  maxRetries: number;
  retryBackoffBaseMs?: number;
  rateLimitPerMinute: number;
}

function resolveTimeoutMs(options: InstrumentationOptions, operation: AIOperation): number {
  return options.operationTimeoutsMs?.[operation] ?? options.timeoutMs;
}

function withTimeout<T>(promise: Promise<T>, ms: number, operation: AIOperation, provider: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AIProviderError(`${operation} timed out after ${ms}ms`, provider, operation, true));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(baseMs: number, attempt: number): number {
  const raw = baseMs * 2 ** attempt;
  const jitterFactor = 0.8 + Math.random() * 0.4; // 0.8x - 1.2x
  return Math.round(raw * jitterFactor);
}

/**
 * Wraps any AIProvider with cross-cutting concerns so individual providers
 * only ever implement "how do I call this vendor" - never retry logic, timeouts,
 * rate limiting, or logging.
 */
export class InstrumentedAIProvider implements AIProvider {
  readonly name: string;

  constructor(
    private readonly raw: AIProvider,
    private readonly options: InstrumentationOptions
  ) {
    this.name = raw.name;
  }

  private async execute<T>(operation: AIOperation, fn: () => Promise<AIResult<T>>): Promise<AIResult<T>> {
    await enforceAIRateLimit(this.name, operation, this.options.rateLimitPerMinute);

    const timeoutMs = resolveTimeoutMs(this.options, operation);
    const backoffBaseMs = this.options.retryBackoffBaseMs ?? 500;

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const result = await withTimeout(fn(), timeoutMs, operation, this.name);

        await aiAuditRepository
          .log({
            provider: this.name,
            model: result.model,
            operation,
            success: true,
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
            costUsd: result.costUsd,
            latencyMs: result.latencyMs,
            retryAttempt: attempt,
          })
          .catch((auditErr) =>
            logger.error('Failed to write AI audit log', { err: (auditErr as Error).message })
          );

        logger.info('AI request succeeded', {
          provider: this.name,
          operation,
          model: result.model,
          costUsd: result.costUsd,
          latencyMs: result.latencyMs,
          attempt,
        });

        return result;
      } catch (err) {
        lastError = err;
        const isRetryable = err instanceof AIProviderError ? err.retryable : true;
        const isLastAttempt = attempt === this.options.maxRetries;

        logger.error('AI request failed', {
          provider: this.name,
          operation,
          attempt,
          timeoutMs,
          retryable: isRetryable,
          error: err instanceof Error ? err.message : String(err),
        });

        await aiAuditRepository
          .log({
            provider: this.name,
            model: 'unknown',
            operation,
            success: false,
            errorMessage: err instanceof Error ? err.message : String(err),
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costUsd: 0,
            latencyMs: 0,
            retryAttempt: attempt,
          })
          .catch(() => {
            /* audit logging must never mask the original error */
          });

        if (!isRetryable || isLastAttempt) {
          break;
        }

        await sleep(backoffDelayMs(backoffBaseMs, attempt));
      }
    }

    if (lastError instanceof AIProviderError) throw lastError;
    throw new AIProviderError(
      lastError instanceof Error ? lastError.message : 'Unknown AI provider error',
      this.name,
      operation,
      false,
      lastError
    );
  }

  analyzeResume(input: AnalyzeResumeInput): Promise<AIResult<ResumeAnalysisResult>> {
    return this.execute('analyzeResume', () => this.raw.analyzeResume(input));
  }

  generateInterviewQuestion(
    input: GenerateQuestionInput
  ): Promise<AIResult<InterviewQuestionResult>> {
    return this.execute('generateInterviewQuestion', () =>
      this.raw.generateInterviewQuestion(input)
    );
  }

  evaluateAnswer(input: EvaluateAnswerInput): Promise<AIResult<AnswerEvaluationResult>> {
    return this.execute('evaluateAnswer', () => this.raw.evaluateAnswer(input));
  }

  generateFollowUpQuestion(input: FollowUpInput): Promise<AIResult<InterviewQuestionResult>> {
    return this.execute('generateFollowUpQuestion', () =>
      this.raw.generateFollowUpQuestion(input)
    );
  }

  summarizeInterview(input: SummarizeInterviewInput): Promise<AIResult<InterviewSummaryResult>> {
    return this.execute('summarizeInterview', () => this.raw.summarizeInterview(input));
  }

  generateFeedback(input: GenerateFeedbackInput): Promise<AIResult<FeedbackResult>> {
    return this.execute('generateFeedback', () => this.raw.generateFeedback(input));
  }

  matchJobDescription(input: MatchJobDescriptionInput): Promise<AIResult<JobMatchResult>> {
    return this.execute('matchJobDescription', () => this.raw.matchJobDescription(input));
  }

  realtimeAgentTurn(input: RealtimeAgentTurnInput): Promise<AIResult<RealtimeAgentTurnResult>> {
    return this.execute('realtimeAgentTurn', () => this.raw.realtimeAgentTurn(input));
  }

  evaluateRealtimeInterview(
    input: RealtimeEvaluationInput
  ): Promise<AIResult<RealtimeEvaluationResult>> {
    return this.execute('evaluateRealtimeInterview', () =>
      this.raw.evaluateRealtimeInterview(input)
    );
  }

  healthCheck(): Promise<boolean> {
    return this.raw.healthCheck();
  }
}