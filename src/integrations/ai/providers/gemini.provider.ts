import { GoogleGenerativeAI } from '@google/generative-ai';
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
import type { z } from 'zod';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private client: GoogleGenerativeAI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is required when AI_PROVIDER=gemini. Get a free key at https://aistudio.google.com/apikey'
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  private async call<T>(
    operation: AIOperation,
    prompt: string,
    schema: z.ZodSchema<T>
  ): Promise<AIResult<T>> {
    const start = Date.now();

    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: { responseMimeType: 'application/json' },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const usage: AIUsage = {
        promptTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: result.response.usageMetadata?.totalTokenCount ?? 0,
      };

      let data: T;
      try {
        data = parseAndValidate(text, schema);
      } catch (parseErr) {
        throw new AIProviderError(
          `Gemini returned a response that didn't match the expected schema for ${operation}`,
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

      // Gemini SDK errors surface as generic Errors; treat rate-limit/5xx-ish
      // messages as retryable, everything else (bad key, bad request) as not.
      const message = err instanceof Error ? err.message : String(err);
      const retryable = /429|500|502|503|504|rate.?limit|timeout/i.test(message);

      throw new AIProviderError(
        `Gemini request failed for ${operation}: ${message}`,
        this.name,
        operation,
        retryable,
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
      const model = this.client.getGenerativeModel({ model: this.model });
      await model.generateContent('Respond with the single word: ok');
      return true;
    } catch {
      return false;
    }
  }
}
