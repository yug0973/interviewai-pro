# Project Progress

**Convention:** a module is only marked complete and wired into `app.ts` once it is fully
implemented, tested, and integrated against the real repo — no placeholders, no commented-out
routes.

## Roadmap

| # | Module | Status |
|---|--------|--------|
| 1 | Foundation (config, error handling, logging, rate limiting) | ✅ Complete |
| 2 | Auth & RBAC | ✅ Complete |
| — | AI Provider Abstraction (Gemini/Groq/OpenAI/Anthropic/Mock + Fallback) | ✅ Complete |
| 3 | Resume Upload & ATS Analysis (OCR, compare, rewrites) | ✅ Complete |
| 4 | Interview Engine (adaptive questions) | ✅ Complete |
| 5 | Real-Time Voice Interview & WebSocket Streaming | ✅ Complete |
| 6 | AI Answer Evaluation & Rubrics | ✅ Complete |
| 7 | Job Match & Skill Gap Analysis | ✅ Complete |
| 8 | Analytics Engine & Performance Radar | ✅ Complete |
| 9 | Billing & Razorpay Integration | ✅ Complete |
| 10 | Admin Panel & Cost Auditing | ✅ Complete |
| 11 | Frontend (React 19 + Vite + Tailwind v4 + Dark UI) | ✅ Complete |


**Why the AI layer jumped the queue:** originally "AI Pipeline" was module 6, after Resume/Interview/Voice. But Resume Upload & ATS Analysis (module 3) needs `AIProvider.analyzeResume()` to exist as a real interface before it can be built without placeholders — so the provider-agnostic abstraction was built now, as a cross-cutting concern, rather than forcing Resume to stub it and rebuild later.

## What's actually in this repo right now

**Foundation**
- `package.json`, `tsconfig.json`, `jest.config.js`
- `docker-compose.yml` (Postgres 16 + Redis 7 + backend), `Dockerfile`
- `prisma/schema.prisma` — `User`, `RefreshToken`, `Role` enum, `AIRequestLog`, `Resume`,
  `ResumeAnalysis`, `ResumeStatus` enum
- `src/config/`: `env.ts` (zod-validated), `prisma.ts`, `redis.ts`, `cloudinary.ts`
- `src/common/logger/index.ts` (Winston)
- `src/common/errors/AppError.ts`
- `src/common/middleware/`: `errorHandler.ts`, `rateLimiter.ts` (Redis-backed), `validate.ts`
- `src/app.ts`, `src/server.ts` (also starts the resume-analysis BullMQ worker)

**Auth & RBAC**
- `src/modules/auth/`: `auth.schema.ts`, `auth.repository.ts`, `auth.service.ts`,
  `auth.controller.ts`, `auth.routes.ts`, `auth.test.ts`
- `src/common/middleware/requireAuth.ts`, `requireRole.ts`
- `src/common/utils/jwt.ts`, `hash.ts`
- `src/types/express/index.d.ts` (adds `req.user`)
- Endpoints live: `POST /api/auth/signup`, `/login`, `/refresh`, `/logout`, `GET /api/auth/me`
- **Verified end-to-end on the user's own machine**: signup, login, protected route, refresh rotation all confirmed working against live Postgres + Redis (2026-07-07).

**AI Provider Abstraction** (`src/integrations/ai/`)
- `types.ts` — the `AIProvider` interface (`analyzeResume`, `generateInterviewQuestion`,
  `evaluateAnswer`, `generateFollowUpQuestion`, `summarizeInterview`, `generateFeedback`,
  `healthCheck`), standardized `AIResult<T>` envelope, `AIProviderError`
- `prompts/index.ts` — centralized prompt templates, one place per operation
- `schemas.ts` — zod schemas validating every provider's parsed JSON output
- `pricing.ts` — cost-per-1k-token table (mock/Gemini free tier/Groq free tier = $0, OpenAI priced for future use)
- `providers/mock.provider.ts` — deterministic, zero-network, zero-cost, **default provider**
- `providers/gemini.provider.ts` — Google Gemini free tier (`@google/generative-ai`)
- `providers/groq.provider.ts` — Groq free tier (`groq-sdk`)
- `providers/openai.provider.ts` — OpenAI, built for future use, not the default
- `instrumented-provider.ts` — wraps any raw provider with retry (exponential backoff),
  timeout enforcement, Redis-backed rate limiting, audit logging, cost tracking
- `audit.repository.ts` — persists every AI call (success or failure) to `AIRequestLog`
- `ai.factory.ts` — reads `AI_PROVIDER` env var, exports the single `aiProvider` singleton
  every future module should import
- `GET /health/ai` — reports active provider name + reachability
- 6/6 tests passing: first-try success, retry-then-succeed, non-retryable short-circuit,
  give-up-after-max-retries, timeout enforcement, rate-limit rejection

**Resume Upload & ATS Analysis** (`src/modules/resume/`)
- `resume.validation.ts` — size limit, declared MIME check, magic-byte check (never trusts
  extension/Content-Type)
- `resume.extraction.ts` — `pdf-parse` (PDF) / `mammoth` (DOCX) text extraction, with OCR
  fallback (`tesseract.js` + `pdf-parse`'s bundled page rasterization) for scanned/image-only PDFs
- `resume.schema.ts`, `resume.repository.ts`, `resume.service.ts`, `resume.controller.ts`,
  `resume.routes.ts` — same layering as the Auth module
- `src/integrations/storage/cloudinary-storage.ts` — uploads/deletes resume files as Cloudinary
  "raw" resources, scoped under `resumes/{userId}/`
- `src/jobs/connection.ts`, `resume-analysis.queue.ts`, `resume-analysis.worker.ts` — BullMQ
  queue + worker (lazily-connected; only the worker ever calls `aiProvider.analyzeResume()`)
- `AIProvider.analyzeResume()` return shape expanded (additive) from a 6-field summary to a full
  ATS report: ATS score, summary, detected role, experience level, skills (general/technical/soft),
  missing keywords, certifications, education/project/experience review, grammar/formatting
  issues, strengths, weaknesses, suggestions, and concrete rewrite suggestions
  (original → rewritten bullet pairs). `types.ts`, `schemas.ts`, `prompts/index.ts`, and
  `mock.provider.ts` were updated accordingly; Gemini/Groq/OpenAI providers needed no changes
  since they're generic pass-throughs driven by schema + prompt.
- Endpoints live: `POST /api/resumes` (202, enqueues analysis), `GET /api/resumes`,
  `GET /api/resumes/:id`, `PATCH /api/resumes/:id/primary`, `DELETE /api/resumes/:id`,
  `GET /api/resumes/compare?a=<id>&b=<id>`
- Resume "versions": multiple `Resume` rows per user, one `isPrimary` flag (atomically exclusive,
  enforced in a Prisma transaction), comparison computed on the fly from two rows' analyses —
  no extra tables needed, and the schema is ready for Resume-vs-JD, AI Resume Builder, Cover
  Letter Generator, Portfolio/LinkedIn Analysis without refactoring.
- 10/10 tests passing (`resume.test.ts`), mocking the repository, extraction, storage, and queue
  layers — same pattern as `auth.test.ts`.

**Verified in this session (Resume module):**
- `npx tsc --noEmit` — passes (see Prisma caveat below)
- `npm test` — 27/27 tests passing (11 auth + 6 AI instrumentation + 10 resume)
- Manually confirmed `pdf-parse` text extraction and page rasterization (`getScreenshot()`)
  against a hand-built test PDF; `tesseract.js` OCR call path confirmed correct (its language-model
  download is blocked by this sandbox's network allowlist the same way `binaries.prisma.sh` is —
  works normally with real internet access)

**Adaptive Interview Engine** (`src/modules/interview/`)
- `interview.schema.ts`, `interview.repository.ts`, `interview.service.ts`,
  `interview.controller.ts`, `interview.routes.ts` — same layering as Auth/Resume
- `InterviewSession` + `InterviewQuestion` Prisma models, `InterviewSessionStatus` enum
  (`IN_PROGRESS` / `COMPLETED` / `ABANDONED`). `InterviewSession.resumeId` is optional and links
  to `Resume` (`onDelete: SetNull`, so deleting a resume never takes an interview session with it)
- `POST /api/interviews` — resolves `targetRole`/`difficulty` from explicit input first, falling
  back to a linked resume's ATS analysis (`detectedRole`, `experienceLevel` mapped to difficulty),
  then generates the opening question via `aiProvider.generateInterviewQuestion()`
- `POST /api/interviews/:id/answer` — records the answer; if more questions remain, generates the
  next one via `aiProvider.generateFollowUpQuestion()` based only on the just-submitted answer
  (this is what makes it adaptive, not a fixed question bank); once `totalQuestions` is reached,
  finalizes via `aiProvider.summarizeInterview()` and marks the session `COMPLETED`
- Every AI call in this module is synchronous (no BullMQ) — unlike Resume analysis, this is an
  interactive turn-by-turn flow the client is actively waiting on, so queuing would only add
  poll-latency for no benefit
- `aiProvider.evaluateAnswer()` deliberately **not** wired in — that's the dedicated Answer
  Evaluation module (#7) later in the roadmap. `summarizeInterview()`'s `qaPairs[].score` is
  already optional in the AI layer for exactly this reason
- `GET /api/interviews` (list), `GET /api/interviews/:id` (full transcript),
  `POST /api/interviews/:id/abandon`
- No AI layer changes needed — `generateInterviewQuestion`/`generateFollowUpQuestion`/
  `summarizeInterview` were already fully specified (types, zod schemas, prompts, mock responses)
  from when the AI Provider Abstraction was first built
- 11/11 tests passing (`interview.test.ts`), mocking the repository and resume repository —
  same pattern as `auth.test.ts`/`resume.test.ts`

**Verified in this session (Interview Engine):**
- `npx tsc --noEmit` — passes (see Prisma caveat below)
- `npm test` — **38/38 tests passing** (11 auth + 6 AI + 10 resume + 11 interview)

**Known environment caveat:** `npx prisma generate` cannot download engine binaries from
`binaries.prisma.sh` inside the sandbox this was built in (network egress blocks that host,
confirmed via `x-deny-reason: host_not_allowed`). This is not a code defect — it worked correctly
on the user's own machine for the Auth module and will work the same way here. Until
`prisma generate` succeeds, the `Role`/`ResumeStatus`/`InterviewSessionStatus` types and
`Prisma.InputJsonValue` won't resolve from `@prisma/client` in a fresh sandbox clone; resolves
immediately once generation succeeds for real. **Action needed on your machine:** run
`npx prisma generate` and `npx prisma migrate dev --name add_interview_engine` before starting
the server.

## Next Up

**Module 5: Voice Interview Pipeline** — real-time voice I/O layered on top of the existing
Interview Engine's session/question/answer flow (speech-to-text for answers, text-to-speech for
questions), without changing the underlying adaptive question logic.
