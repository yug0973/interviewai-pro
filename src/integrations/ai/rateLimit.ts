import { redis } from '../../config/redis';
import { AIProviderError } from './types';
import type { AIOperation } from './types';

/**
 * Fixed-window limiter keyed by provider name (not by user) - this protects
 * the shared free-tier quota with the AI vendor, which is a per-API-key limit,
 * not a per-user one.
 */
export async function enforceAIRateLimit(
  provider: string,
  operation: AIOperation,
  limitPerMinute: number
): Promise<void> {
  if (redis.status !== 'ready') return;

  try {
    const key = `ai-ratelimit:${provider}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }

    if (count > limitPerMinute) {
      throw new AIProviderError(
        `AI rate limit exceeded for provider "${provider}" (${limitPerMinute}/min). Try again shortly.`,
        provider,
        operation,
        true
      );
    }
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    // Ignore Redis errors so transient redis issues don't crash AI requests
  }
}
