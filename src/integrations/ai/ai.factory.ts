import { env } from '../../config/env';
import type { AIProvider, AIOperation } from './types';
import { MockAIProvider } from './providers/mock.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { InstrumentedAIProvider } from './instrumented-provider';
import { FallbackAIProvider } from './fallback-provider';

type SupportedProvider = typeof env.AI_PROVIDER;

function createRawProvider(name: SupportedProvider): AIProvider {
  switch (name) {
    case 'gemini':
      return new GeminiProvider(env.GEMINI_API_KEY ?? '', env.GEMINI_MODEL);
    case 'groq':
      return new GroqProvider(env.GROQ_API_KEY ?? '', env.GROQ_MODEL);
    case 'openai':
      return new OpenAIProvider(env.OPENAI_API_KEY ?? '', env.OPENAI_MODEL);
    case 'anthropic':
      return new AnthropicProvider(env.ANTHROPIC_API_KEY ?? '', env.ANTHROPIC_MODEL);
    case 'mock':
    default:
      return new MockAIProvider();
  }
}

/**
 * Operations that run synchronously inside an HTTP request (one interview
 * turn = evaluateAnswer then generateFollowUpQuestion/generateInterviewQuestion,
 * both blocking the response) and must fail fast so the user isn't stuck
 * staring at a spinner.
 */
const INTERACTIVE_OPERATIONS: readonly AIOperation[] = [
  'generateInterviewQuestion',
  'evaluateAnswer',
  'generateFollowUpQuestion',
];

/**
 * Operations that run off the request path or require deeper processing
 * (analyzeResume, summarizeInterview, matchJobDescription, generateFeedback).
 */
const HEAVY_OPERATIONS: readonly AIOperation[] = [
  'analyzeResume',
  'summarizeInterview',
  'generateFeedback',
  'matchJobDescription',
];

function buildOperationTimeouts(): Partial<Record<AIOperation, number>> {
  const map: Partial<Record<AIOperation, number>> = {};
  for (const op of INTERACTIVE_OPERATIONS) map[op] = env.AI_REQUEST_TIMEOUT_MS;
  for (const op of HEAVY_OPERATIONS) map[op] = env.AI_HEAVY_REQUEST_TIMEOUT_MS;
  return map;
}

function instrument(raw: AIProvider): AIProvider {
  return new InstrumentedAIProvider(raw, {
    timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    operationTimeoutsMs: buildOperationTimeouts(),
    maxRetries: env.AI_MAX_RETRIES,
    retryBackoffBaseMs: env.AI_RETRY_BACKOFF_BASE_MS,
    rateLimitPerMinute: env.AI_RATE_LIMIT_PER_MINUTE,
  });
}

function buildProvider(): AIProvider {
  const primary = instrument(createRawProvider(env.AI_PROVIDER));

  // Fallback is opt-in and only meaningful when it points at a genuinely
  // different provider - each has its own independent quota.
  if (!env.AI_FALLBACK_PROVIDER || env.AI_FALLBACK_PROVIDER === env.AI_PROVIDER) {
    return primary;
  }

  const secondary = instrument(createRawProvider(env.AI_FALLBACK_PROVIDER));
  return new FallbackAIProvider(primary, secondary);
}

/**
 * The ONLY thing application code (Resume Service, Interview Service, etc.)
 * should ever import from the AI integration.
 */
export const aiProvider: AIProvider = buildProvider();