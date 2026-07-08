# Changelog

## [Unreleased]

### Added — Adaptive Interview Engine
- `POST /api/interviews` — starts a session; resolves `targetRole`/`difficulty` from explicit
  input or a linked resume's ATS analysis, then generates the opening question
- `POST /api/interviews/:id/answer` — records the answer and either returns the next adaptive
  follow-up question (`aiProvider.generateFollowUpQuestion()`, based only on the answer just
  given) or, once `totalQuestions` is reached, finalizes the session via
  `aiProvider.summarizeInterview()` and marks it `COMPLETED`
- Every turn is a single synchronous AI call, not queued via BullMQ — this is an interactive
  flow the client is actively waiting on, unlike the one-shot Resume analysis job
- `aiProvider.evaluateAnswer()` intentionally not wired in yet — reserved for the dedicated
  Answer Evaluation module later in the roadmap
- `InterviewSession` (optionally linked to a `Resume`, `onDelete: SetNull`) and
  `InterviewQuestion` Prisma models, `InterviewSessionStatus` enum
- `GET /api/interviews`, `GET /api/interviews/:id`, `POST /api/interviews/:id/abandon`
- 11 new tests (`interview.test.ts`), mocking the interview and resume repositories
  (38/38 total tests passing)
- No changes needed to the AI Provider Abstraction — `generateInterviewQuestion`,
  `generateFollowUpQuestion`, and `summarizeInterview` were already fully specified when that
  layer was first built

### Added — Resume Upload & ATS Analysis
- `POST /api/resumes` — multipart upload, returns `202 Accepted` immediately, analysis runs async
- File validation: size limit, declared MIME check, and magic-byte inspection (never trusts the
  extension or client-declared Content-Type)
- Text extraction: `pdf-parse` (PDF) and `mammoth` (DOCX), with automatic OCR fallback
  (`tesseract.js`, via `pdf-parse`'s bundled page rasterization) for scanned/image-only PDFs
- Cloudinary storage integration (`raw` resource type, scoped per user) —
  `src/integrations/storage/cloudinary-storage.ts`
- BullMQ queue + worker (`src/jobs/`) — lazily-connected so importing the module never opens a
  Redis connection until a resume is actually uploaded; worker is the only caller of
  `aiProvider.analyzeResume()`
- `Resume` and `ResumeAnalysis` Prisma models, `ResumeStatus` enum
- Resume versions with an atomically-exclusive `isPrimary` flag, and on-the-fly comparison
  (`GET /api/resumes/compare`) — no extra history/comparison tables needed
- Full CRUD: `GET /api/resumes`, `GET /api/resumes/:id`, `PATCH /api/resumes/:id/primary`,
  `DELETE /api/resumes/:id`
- 10 new tests (`resume.test.ts`), mocking repository/extraction/storage/queue layers
  (27/27 total tests passing)
- Added `.gitignore` (was missing from the repo entirely) — excludes `node_modules`, `.env`,
  `dist`, and the new `.tesseract-cache/` OCR language-model cache

### Changed — AI Provider Abstraction
- `AIProvider.analyzeResume()` return shape expanded (additive, no breaking changes to Auth or
  the AI instrumentation tests) from a 6-field summary to the full ATS report shape the Resume
  module needs: detected role, experience level, general/technical/soft skills, certifications,
  education/project/experience review, grammar/formatting issues, and concrete rewrite
  suggestions, on top of the original ATS score/summary/strengths/weaknesses/missingKeywords/suggestions
- Updated `types.ts`, `schemas.ts`, `prompts/index.ts`, `mock.provider.ts`, and `ai.test.ts`'s
  fake-result helper accordingly. Gemini/Groq/OpenAI provider files needed **no** changes, since
  they're generic pass-throughs driven entirely by schema + prompt.

### Added — AI Provider Abstraction (pulled forward from module 6, ahead of Resume module)
- `AIProvider` interface: `analyzeResume`, `generateInterviewQuestion`, `evaluateAnswer`,
  `generateFollowUpQuestion`, `summarizeInterview`, `generateFeedback`, `healthCheck`
- Standardized `AIResult<T>` response envelope (data, usage, costUsd, provider, model, latencyMs)
- Centralized prompt templates (`prompts/index.ts`) — one place per operation, not duplicated per vendor
- zod schemas validating every provider's parsed JSON before it re-enters the app (`schemas.ts`)
- Four providers behind the same interface: `mock` (default, zero cost, zero network),
  `gemini` (free tier), `groq` (free tier), `openai` (future use, real pricing)
- `InstrumentedAIProvider`: retry with exponential backoff, timeout enforcement, Redis-backed
  rate limiting per provider, audit logging, cost tracking — added once, applies to every provider
- `AIRequestLog` Prisma model + `audit.repository.ts` — persists every AI call (success or failure)
- `AI_PROVIDER` env var selects the active provider; `ai.factory.ts` exports the single
  `aiProvider` singleton the rest of the app imports
- `GET /health/ai` — reports active provider + reachability
- 6 new tests covering retry, non-retryable short-circuit, max-retry exhaustion, timeout, and
  rate-limit rejection (17/17 total tests passing)

### Added — Foundation
- Project scaffold: `package.json`, `tsconfig.json`, Docker Compose (Postgres + Redis + backend), Dockerfile
- Zod-validated environment config (`src/config/env.ts`)
- Prisma client singleton, Redis connection, Winston logger, Cloudinary config
- `AppError` class and centralized Express error-handling middleware
- Redis-backed fixed-window rate limiter middleware
- Base Prisma schema: `User`, `RefreshToken`, `Role` enum

### Added — Auth & RBAC
- Signup, login, refresh (with rotation + reuse detection), logout, `GET /me`
- `requireAuth` and `requireRole` middleware
- JWT utilities (access + refresh signing/verification)
- Password hashing via `bcryptjs` (swapped from `bcrypt` — no native build step)
- 11 passing Jest + Supertest tests covering the full auth flow, including refresh-token
  reuse detection

### Fixed
- `jsonwebtoken`'s `expiresIn` option required a narrower type than the plain `string` coming
  from env validation — cast explicitly rather than loosening the type globally
- Test double for refresh-token rotation was overwriting the old token record on rotation instead
  of tracking both by id — fixed to use a map keyed by `jti`
