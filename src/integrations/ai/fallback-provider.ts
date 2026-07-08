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
import { logger } from '../../common/logger';

/**
 * Wraps a primary and a secondary AIProvider.
 */
export class FallbackAIProvider implements AIProvider {
  readonly name: string;

  constructor(
    private readonly primary: AIProvider,
    private readonly secondary: AIProvider
  ) {
    this.name = `${primary.name}+fallback:${secondary.name}`;
  }

  private async execute<T>(
    operation: AIOperation,
    callPrimary: (p: AIProvider) => Promise<AIResult<T>>
  ): Promise<AIResult<T>> {
    try {
      return await callPrimary(this.primary);
    } catch (primaryErr) {
      logger.error('Primary AI provider exhausted retries - falling back', {
        operation,
        primaryProvider: this.primary.name,
        fallbackProvider: this.secondary.name,
        error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      });

      try {
        const result = await callPrimary(this.secondary);
        logger.info('Fallback AI provider succeeded', {
          operation,
          fallbackProvider: this.secondary.name,
        });
        return result;
      } catch (fallbackErr) {
        logger.error('Fallback AI provider also failed', {
          operation,
          fallbackProvider: this.secondary.name,
          error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        });
        if (fallbackErr instanceof AIProviderError) throw fallbackErr;
        throw new AIProviderError(
          fallbackErr instanceof Error ? fallbackErr.message : 'Unknown fallback provider error',
          this.secondary.name,
          operation,
          false,
          fallbackErr
        );
      }
    }
  }

  analyzeResume(input: AnalyzeResumeInput): Promise<AIResult<ResumeAnalysisResult>> {
    return this.execute('analyzeResume', (p) => p.analyzeResume(input));
  }

  generateInterviewQuestion(
    input: GenerateQuestionInput
  ): Promise<AIResult<InterviewQuestionResult>> {
    return this.execute('generateInterviewQuestion', (p) => p.generateInterviewQuestion(input));
  }

  evaluateAnswer(input: EvaluateAnswerInput): Promise<AIResult<AnswerEvaluationResult>> {
    return this.execute('evaluateAnswer', (p) => p.evaluateAnswer(input));
  }

  generateFollowUpQuestion(input: FollowUpInput): Promise<AIResult<InterviewQuestionResult>> {
    return this.execute('generateFollowUpQuestion', (p) => p.generateFollowUpQuestion(input));
  }

  summarizeInterview(input: SummarizeInterviewInput): Promise<AIResult<InterviewSummaryResult>> {
    return this.execute('summarizeInterview', (p) => p.summarizeInterview(input));
  }

  generateFeedback(input: GenerateFeedbackInput): Promise<AIResult<FeedbackResult>> {
    return this.execute('generateFeedback', (p) => p.generateFeedback(input));
  }

  matchJobDescription(input: MatchJobDescriptionInput): Promise<AIResult<JobMatchResult>> {
    return this.execute('matchJobDescription', (p) => p.matchJobDescription(input));
  }

  realtimeAgentTurn(input: RealtimeAgentTurnInput): Promise<AIResult<RealtimeAgentTurnResult>> {
    return this.execute('realtimeAgentTurn', (p) => p.realtimeAgentTurn(input));
  }

  evaluateRealtimeInterview(
    input: RealtimeEvaluationInput
  ): Promise<AIResult<RealtimeEvaluationResult>> {
    return this.execute('evaluateRealtimeInterview', (p) => p.evaluateRealtimeInterview(input));
  }

  async healthCheck(): Promise<boolean> {
    return (await this.primary.healthCheck()) || (await this.secondary.healthCheck());
  }
}