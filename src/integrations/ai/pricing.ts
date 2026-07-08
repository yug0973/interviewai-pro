import type { AIUsage } from './types';

interface ModelPricing {
  /** USD per 1,000 prompt tokens */
  inputPer1k: number;
  /** USD per 1,000 completion tokens */
  outputPer1k: number;
}

/**
 * Free-tier models are priced at $0 here deliberately - this app is built to
 * run at zero cost by default. If you move to a paid tier/model, add its real
 * per-1k pricing here and cost tracking updates automatically everywhere.
 */
const PRICING_TABLE: Record<string, ModelPricing> = {
  'mock:mock-model': { inputPer1k: 0, outputPer1k: 0 },

  // Gemini free tier (aistudio.google.com) - $0 while under free-tier rate limits
  'gemini:gemini-1.5-flash': { inputPer1k: 0, outputPer1k: 0 },
  'gemini:gemini-1.5-pro': { inputPer1k: 0, outputPer1k: 0 },

  // Groq free tier - $0 while under free-tier rate limits
  'groq:llama-3.1-8b-instant': { inputPer1k: 0, outputPer1k: 0 },
  'groq:llama-3.3-70b-versatile': { inputPer1k: 0, outputPer1k: 0 },

  // OpenAI - real paid pricing (as of this app's last pricing check), kept
  // here for when/if you add billing later. Update if OpenAI changes prices.
  'openai:gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },

  // Anthropic - no ongoing free tier (only a one-time trial credit on
  // signup), so this is real paid pricing from day one. Haiku 4.5 is the
  // cheapest current-generation model: $1/$5 per million tokens.
  'anthropic:claude-haiku-4-5-20251001': { inputPer1k: 0.001, outputPer1k: 0.005 },
};

export function calculateCostUsd(provider: string, model: string, usage: AIUsage): number {
  const pricing = PRICING_TABLE[`${provider}:${model}`];
  if (!pricing) {
    // Unknown model - don't silently report $0 for a possibly-paid model, but
    // don't crash the request either. Log-worthy, handled by the caller.
    return 0;
  }

  return (
    (usage.promptTokens / 1000) * pricing.inputPer1k +
    (usage.completionTokens / 1000) * pricing.outputPer1k
  );
}