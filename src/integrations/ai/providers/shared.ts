/** Shared heuristic: rate limits, timeouts, and 5xx are worth retrying; auth/validation errors are not. */
export function isRetryableMessage(message: string): boolean {
  return /429|500|502|503|504|rate.?limit|timeout|ECONNRESET|ETIMEDOUT/i.test(message);
}
