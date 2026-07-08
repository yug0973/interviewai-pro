import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  REFRESH_COOKIE_NAME: z.string().default('iap_refresh'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // --- AI provider abstraction ---
  // Defaults to 'mock' on purpose: the app must run and be fully testable
  // with zero API keys and zero cost. Switch to a real provider explicitly.
  AI_PROVIDER: z.enum(['mock', 'gemini', 'groq', 'openai', 'anthropic']).default('mock'),
  // Optional. When set, and different from AI_PROVIDER, requests only fall
  // back to this provider after the primary has already exhausted its own
  // retries (see fallback-provider.ts) - handles cases the primary's own
  // retries can never fix, like a daily quota exhaustion rather than a
  // transient blip. Leave unset to disable fallback entirely.
  AI_FALLBACK_PROVIDER: z.enum(['mock', 'gemini', 'groq', 'openai', 'anthropic']).optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5-20251001'),

  // Interactive, per-turn calls (question gen, evaluate, follow-up) run
  // synchronously inside an HTTP request and must fail fast.
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().default(20000),
  // Heavy calls (resume analysis, interview summary, feedback) run off the
  // request path (background worker / async job) and can afford to wait
  // much longer for a provider to recover from a transient outage.
  AI_HEAVY_REQUEST_TIMEOUT_MS: z.coerce.number().default(60000),
  AI_MAX_RETRIES: z.coerce.number().default(3),
  // Base delay for exponential backoff between retries (base, base*2, base*4...).
  // A vendor 503 "high demand" response needs several seconds of breathing
  // room, not milliseconds, to have any real chance of succeeding on retry.
  AI_RETRY_BACKOFF_BASE_MS: z.coerce.number().default(3000),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(15), // Gemini free-tier flash default

  // --- Billing (Razorpay) ---
  // Optional like Cloudinary: the app must still boot and be testable with no keys set.
  // Actual order creation will fail with a clear error if these are missing.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PRO_PLAN_AMOUNT_PAISE: z.coerce.number().default(49900), // ₹499
  RAZORPAY_PRO_PLAN_DURATION_DAYS: z.coerce.number().default(30),

  // --- Free tier limits (PRO users bypass these entirely) ---
  FREE_RESUME_UPLOADS_PER_MONTH: z.coerce.number().default(3),
  FREE_INTERVIEWS_PER_MONTH: z.coerce.number().default(3),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;