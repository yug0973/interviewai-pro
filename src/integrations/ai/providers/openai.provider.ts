import OpenAI from 'openai';
import type {
  AIProvider,
  AIResult,
  AIUsage,
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
} from '../types';
import { AIProviderError } from '../types';
import { prompts } from '../prompts';
import {
  resumeAnalysisSchema,
  interviewQuestionSchema,
  answerEvaluationSchema,
  interviewSummarySchema,
  feedbackSchema,
  jobMatchSchema,
  realtimeAgentTurnSchema,
  realtimeEvaluationSchema,
  parseAndValidate,
} from '../schemas';
import { calculateCostUsd } from '../pricing';
import { isRetryableMessage } from './shared';
import type { z } from 'zod';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai.');
    }
    this.client = new OpenAI({ apiKey });
  }

  private async call<T>(
    operation: AIOperation,
    prompt: string,
    schema: z.ZodSchema<T>
  ): Promise<AIResult<T>> {
    const start = Date.now();

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const text = completion.choices[0]?.message?.content ?? '';

      const usage: AIUsage = {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      };

      let data: T;
      try {
        data = parseAndValidate(text, schema);
      } catch (parseErr) {
        throw new AIProviderError(
          `OpenAI returned a response that didn't match the expected schema for ${operation}`,
          this.name,
          operation,
          false,
          parseErr
        );
      }

      return {
        data,
        usage,
        costUsd: calculateCostUsd(this.name, this.model, usage),
        provider: this.name,
        model: this.model,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new AIProviderError(
        `OpenAI request failed for ${operation}: ${message}`,
        this.name,
        operation,
        isRetryableMessage(message),
        err
      );
    }
  }

  analyzeResume(input: AnalyzeResumeInput): Promise<AIResult<ResumeAnalysisResult>> {
    return this.call('analyzeResume', prompts.analyzeResume(input), resumeAnalysisSchema);
  }

  generateInterviewQuestion(
    input: GenerateQuestionInput
  ): Promise<AIResult<InterviewQuestionResult>> {
    return this.call(
      'generateInterviewQuestion',
      prompts.generateInterviewQuestion(input),
      interviewQuestionSchema
    );
  }

  evaluateAnswer(input: EvaluateAnswerInput): Promise<AIResult<AnswerEvaluationResult>> {
    return this.call('evaluateAnswer', prompts.evaluateAnswer(input), answerEvaluationSchema);
  }

  generateFollowUpQuestion(input: FollowUpInput): Promise<AIResult<InterviewQuestionResult>> {
    return this.call(
      'generateFollowUpQuestion',
      prompts.generateFollowUpQuestion(input),
      interviewQuestionSchema
    );
  }

  summarizeInterview(input: SummarizeInterviewInput): Promise<AIResult<InterviewSummaryResult>> {
    return this.call(
      'summarizeInterview',
      prompts.summarizeInterview(input),
      interviewSummarySchema
    );
  }

  generateFeedback(input: GenerateFeedbackInput): Promise<AIResult<FeedbackResult>> {
    return this.call('generateFeedback', prompts.generateFeedback(input), feedbackSchema);
  }

  matchJobDescription(input: MatchJobDescriptionInput): Promise<AIResult<JobMatchResult>> {
    return this.call('matchJobDescription', prompts.matchJobDescription(input), jobMatchSchema);
  }

  realtimeAgentTurn(input: RealtimeAgentTurnInput): Promise<AIResult<RealtimeAgentTurnResult>> {
    return this.call(
      'realtimeAgentTurn',
      prompts.realtimeAgentTurn(input),
      realtimeAgentTurnSchema
    );
  }

  evaluateRealtimeInterview(
    input: RealtimeEvaluationInput
  ): Promise<AIResult<RealtimeEvaluationResult>> {
    return this.call(
      'evaluateRealtimeInterview',
      prompts.evaluateRealtimeInterview(input),
      realtimeEvaluationSchema
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Respond with the single word: ok' }],
        max_tokens: 5,
      });
      return true;
    } catch {
      return false;
    }
  }
}
