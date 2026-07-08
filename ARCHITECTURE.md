# Architecture

## Layering

Every module follows the same layering, so once you understand one module you understand all of them:

```
routes.ts      → HTTP method + path + middleware wiring, no logic
controller.ts  → translates HTTP req/res into service calls, no business logic
service.ts     → all business rules live here (this is the layer you defend in interviews)
repository.ts  → all Prisma/DB queries, nothing else
schema.ts      → zod request validation schemas
```

Why: it means "what does the API do" (routes/controller) is separated from "what are the business
rules" (service) is separated from "how is this stored" (repository). You can swap Postgres for
something else without touching business logic; you can add a CLI or a queue consumer that calls
the same service functions without duplicating rules.

## Auth & RBAC

- **Access tokens** are short-lived JWTs (`ACCESS_TOKEN_TTL`, default 15m), sent in the
  `Authorization: Bearer` header, verified by `requireAuth` middleware on every protected route.
- **Refresh tokens** are longer-lived JWTs (default 30 days) delivered as an `httpOnly`,
  `sameSite=lax` cookie scoped to `/api/auth` — never readable by client-side JS, so an XSS bug
  can't exfiltrate it.
- **Rotation + reuse detection:** every refresh token has a `jti` (JWT ID) persisted in the
  `refresh_tokens` table. Using a refresh token always issues a brand-new one and marks the old
  `jti` as `revoked`. If a *revoked* `jti` is ever presented again, that's treated as a stolen
  token being replayed — every refresh token for that user is revoked immediately, forcing a
  fresh login everywhere. This is the standard mitigation for refresh token theft.
- **RBAC** is a separate `requireRole(...)` middleware that reads `req.user.role` (set by
  `requireAuth`) — kept as its own middleware rather than baked into `requireAuth`, since some
  routes need authentication without a role restriction.

## Why Redis-backed rate limiting, not in-memory

The rate limiter (`common/middleware/rateLimiter.ts`) increments a Redis key per IP/route. If this
were an in-memory counter, it would reset on every server restart and wouldn't be shared across
multiple server instances behind a load balancer — Redis fixes both, and we already need Redis for
BullMQ, so there's no new infra cost.

## Why bcryptjs instead of bcrypt

`bcrypt` ships a native (C++) binding that needs to compile on install. `bcryptjs` is a pure-JS
implementation of the same algorithm with an identical API — slightly slower per-hash, negligible
at this scale, but zero native build step, which matters for portability across CI runners,
containers, and restricted sandboxes. Same security properties, easier ops.

## Module Dependency Order

Modules are built in strict dependency order, and a module is only wired into `app.ts` once fully
implemented against the real repo (no commented-out routes, no partial integration). See
`PROJECT_PROGRESS.md` for the current state and full roadmap.

## Resume Module

Full pipeline, in order:

```
POST /api/resumes (multipart, requireAuth)
       │
       ▼
resume.validation.ts  → size limit, declared MIME check, magic-byte check (never trust extension)
       │
       ▼
resume.extraction.ts  → pdf-parse (PDF) / mammoth (DOCX)
       │                if PDF text layer is empty/near-empty (scanned image) → OCR fallback
       │                (pdf-parse's getScreenshot() rasterizes pages → tesseract.js OCRs them)
       ▼
cloudinary-storage.ts → original file uploaded as a Cloudinary "raw" resource
       │
       ▼
Resume row created, status=PROCESSING → 202 Accepted returned to the client immediately
       │
       ▼
BullMQ job enqueued (resume-analysis queue)
       │                                    ← worker runs in the same process (server.ts),
       ▼                                       concurrency: 3
resume-analysis.worker.ts → aiProvider.analyzeResume({ resumeText, targetRole })
       │
       ▼
ResumeAnalysis row persisted, Resume.status → COMPLETED (or FAILED + failureReason)
```

**Why extraction happens synchronously, before the BullMQ job:** the job needs to know whether
there's a text/OCR failure *before* deciding to call the AI provider at all, and text/OCR
extraction is fast (milliseconds to a few seconds) compared to an LLM call. Only the AI analysis
step — the actually slow, externally-rate-limited part — is queued.

**Why BullMQ retries are thin (`attempts: 2`) instead of duplicating the AI layer's retry logic:**
`InstrumentedAIProvider` already retries transient AI failures internally with exponential
backoff. The BullMQ-level retry exists only as an outer safety net for infra failures (e.g. the
worker process crashing mid-job), not to re-implement AI retry logic a second time.

**Why the BullMQ connection is lazily constructed:** `Queue`/`Worker` open a real Redis
connection on construction to check server compatibility. Constructing them at module-import
time would mean simply importing the resume module (e.g. transitively through `app.ts`) tries to
reach Redis — breaking any code path, including unrelated tests, that never actually touches a
resume. See `jobs/resume-analysis.queue.ts` / `connection.ts`.

**Resume versions, primary resume, comparison:** a user can have many `Resume` rows (one per
upload), each with its own `ResumeAnalysis`. "Primary" is a boolean flag, atomically exclusive per
user (enforced in a Prisma transaction in `resume.repository.ts`). Comparison and ATS-history
charts are computed on the fly from existing rows — no dedicated history/comparison table was
needed. This also means future features (Resume vs JD, AI Resume Builder, Cover Letter Generator,
Portfolio/LinkedIn Analysis) can reuse `Resume.extractedText` and `targetRole` without refactoring
this schema.

**Magic-byte validation:** client-declared MIME type and file extension are both spoofable, so
`resume.validation.ts` inspects the actual leading bytes (`%PDF` for PDF; `PK\x03\x04` for DOCX,
which is a zip container) before anything else runs.

**OCR fallback, concretely:** `pdf-parse` v2 bundles `@napi-rs/canvas` + `pdfjs-dist` internally
and exposes `getScreenshot()` to rasterize pages to PNG — chosen specifically because
`@napi-rs/canvas` ships prebuilt native binaries for Windows, macOS, Linux glibc, *and* Linux musl
(Alpine), so there's no native build toolchain required on your machine or in the Alpine-based
Docker image. `tesseract.js` then OCRs each page (pure WASM, zero native deps). This needs
internet access once, to download the English language model — cached locally afterwards in
`.tesseract-cache/`.

## Interview Engine

```
POST /api/interviews (targetRole | resumeId, requireAuth)
       │
       ▼
resolve targetRole/difficulty:
  explicit input  >  linked resume's ATS analysis (detectedRole, experienceLevel→difficulty)  >  error
       │
       ▼
aiProvider.generateInterviewQuestion({ role, difficulty })  ← synchronous, single call
       │
       ▼
InterviewSession (IN_PROGRESS) + InterviewQuestion #1 created → 201 { session, currentQuestion }


POST /api/interviews/:id/answer (answerText)
       │
       ▼
find latest unanswered question → record the answer
       │
       ├─ more questions remain (order < totalQuestions)
       │        │
       │        ▼
       │  aiProvider.generateFollowUpQuestion({ originalQuestion, candidateAnswer, role })
       │        │
       │        ▼
       │  next InterviewQuestion created (isFollowUp: true) → 200 { session, currentQuestion }
       │
       └─ that was the last question
                │
                ▼
          aiProvider.summarizeInterview({ role, qaPairs })
                │
                ▼
          session.status → COMPLETED, overallScore/strengths/weaknesses/recommendation persisted
                → 200 { session, currentQuestion: null, completed: true }
```

**Why this is real-time/synchronous, unlike Resume analysis (which is queued via BullMQ):**
Resume analysis is a single heavy call the client isn't actively waiting on turn-by-turn - a
202-and-poll pattern fits. An interview is an interactive conversation: the client submits an
answer and needs the next question right away to keep the flow going. Queuing each turn would
add latency (poll delay) for no benefit, since there's no batching or heavy background work
happening - just one AI call per turn, same cost either way.

**Why it's "adaptive":** every question after the first comes from `generateFollowUpQuestion()`,
which only takes the *immediately preceding* question+answer - not a fixed topic list or question
bank. The interview genuinely branches based on what the candidate just said.

**Why `evaluateAnswer()` is not called here:** per-answer scoring is a separate concern
(the dedicated Answer Evaluation module later in the roadmap) from generating the next question.
Coupling them would mean Interview Engine couldn't ship without Answer Evaluation also being
done. `summarizeInterview()`'s `qaPairs[].score` field is already optional in the AI layer for
exactly this reason - wiring in per-answer scores later needs no schema change here.

**Difficulty inheritance from a resume:** `entry`/`junior` → `easy`, `mid` → `medium`,
`senior`/`lead` → `hard` (see `EXPERIENCE_LEVEL_TO_DIFFICULTY` in `interview.service.ts`). Only
used when the caller links a resume and doesn't explicitly pass `difficulty`.

## AI Provider Abstraction

Every AI-touching feature (resume analysis, question generation, answer evaluation, interview
summaries, feedback) talks to a single `AIProvider` interface — never to a vendor SDK directly.

```
Resume Service (or any future service)
       │
       ▼
aiProvider.analyzeResume(input)     ← imported from ai.factory.ts, typed as AIProvider
       │
       ▼
InstrumentedAIProvider              ← retry, timeout, rate limit, audit log, cost tracking
       │
       ▼
GeminiProvider / GroqProvider / OpenAIProvider / MockAIProvider
```

**Why this shape:**

- **Swapping vendors is a one-line env change** (`AI_PROVIDER=gemini` → `groq`), not a code change,
  because business logic (Resume Service, future Interview/Evaluation services) only ever imports
  the `AIProvider` type and the `aiProvider` singleton — never a provider class.
- **Cross-cutting concerns live in exactly one place** (`instrumented-provider.ts`): every provider
  automatically gets retry-with-backoff, a timeout, Redis-backed rate limiting, audit logging to
  Postgres, and cost tracking, without duplicating any of that logic per vendor.
- **Retryable vs. non-retryable errors are distinguished on purpose.** A malformed JSON response
  (schema mismatch) is a prompt/model problem retrying won't fix — it fails immediately. A 429 or
  timeout is transient — it retries with exponential backoff (500ms, 1s, 2s, ...).
- **Standardized output, not just standardized input.** Every provider parses its raw response
  into the same JSON shape and validates it with zod (`schemas.ts`) before it's ever handed back to
  application code. If Gemini or Groq returns something that doesn't match, that's caught as an
  `AIProviderError`, not silently stored as garbage.
- **Defaults to zero cost.** `AI_PROVIDER=mock` requires no API key, makes no network calls, and
  returns realistic-shaped fake data instantly — the whole app (including every future AI feature)
  is fully buildable and testable without spending anything or waiting on rate limits. Gemini and
  Groq's free tiers are also priced at $0 in `pricing.ts`; only OpenAI has real per-token pricing,
  kept ready for if/when you want it.
- **Audit trail for defensibility.** Every AI call (success or failure) writes an `AIRequestLog`
  row — provider, model, operation, token usage, cost, latency, retry count. This is the kind of
  observability an interviewer (or an investor's technical diligence) will expect to see for any
  product built around LLM calls.

**Adding a new provider** (e.g. local Ollama/LM Studio later): implement the `AIProvider`
interface in a new file under `providers/`, add a case to `ai.factory.ts`'s switch statement, add
its pricing to `pricing.ts`. Nothing else in the app changes.
