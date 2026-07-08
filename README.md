# InterviewAI Pro

AI-powered career preparation and real-time voice mock interview platform.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2d3748.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791.svg)](https://www.postgresql.org/)
[![Redis & BullMQ](https://img.shields.io/badge/Queue-Redis%20%2F%20BullMQ-red.svg)](https://bullmq.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Overview

InterviewAI Pro is a full-stack platform designed to simulate technical and behavioral interviews. It combines resume parsing and ATS scoring, a multi-provider AI abstraction layer, dynamic adaptive questioning, low-latency WebSocket voice streaming, session integrity monitoring, job description matching, and candidate performance analytics into a single unified application.

---

## Core Capabilities

### 1. Resume Parsing and ATS Analysis
- **File Format Support:** Extracts clean text from PDF and DOCX documents.
- **OCR Fallback Pipeline:** Automatic rasterization and `tesseract.js` OCR extraction for scanned or image-based resumes lacking embedded text.
- **ATS Evaluation:** Generates ATS scores, role and seniority detection, keyword coverage, formatting critiques, bullet-point impact analysis, and concrete before/after rewrite recommendations.
- **Version Comparison:** Side-by-side comparative diffing across multiple resume versions to track profile revisions over time.
- **Asynchronous Processing:** Powered by Redis and BullMQ worker queues for non-blocking background analysis.

### 2. Real-Time Voice and Audio Interview Room
- **Duplex Streaming:** Built on WebSockets (`/ws/interview`) for low-latency turn-taking and interactive exchanges.
- **Speech-to-Text and Text-to-Speech:** Browser Web Speech API integration with fallbacks and manual controls.
- **Dynamic Waveform Visualization:** Visual indicators reflecting candidate speech and AI interviewer activity.
- **Session Integrity Monitoring:** Tracks tab switches, window blur events, and abnormal activity with post-session reporting.

### 3. Adaptive Interview Engine and Rubric Scoring
- **Contextual Questioning:** Dynamically generates follow-up questions conditioned on the candidate's previous response rather than using static question banks.
- **Rubric-Based Evaluation:** Evaluates answers based on technical accuracy, problem-solving depth, communication clarity, and the STAR framework (Situation, Task, Action, Result).
- **Executive Summary:** Synthesizes overall performance, key strengths, areas for development, and a hiring recommendation.

### 4. Job Description Match and Skill Gap Analysis
- **Job Description Comparison:** Compares target job descriptions directly against uploaded resumes.
- **Keyword and Competency Matching:** Identifies missing technical requirements and keywords necessary to pass applicant tracking systems.
- **Actionable Roadmap:** Outlines prioritized skill acquisition steps tailored to the target role.

### 5. Analytics and Candidate Dashboard
- **Performance Trajectory:** Tracks interview score history and progression over time.
- **Skill Radar:** Categorical breakdown highlighting behavioral vs. technical readiness.
- **Session Logs:** Searchable transcripts, rubric ratings, and interview takeaways.

### 6. Subscriptions and Billing
- **Tiered Plans:** Configurable Free, Pro, and Enterprise subscription tiers.
- **Razorpay Integration:** Order generation, client checkout modal handling, and cryptographic webhook validation (`order.paid`, `payment.authorized`).

### 7. Administration and AI Auditing
- **System Metrics:** Platform health metrics, active user stats, and session volume tracking.
- **AI Audit Logs:** Persistent logging capturing prompt tokens, completion tokens, latency, cost in USD, and provider error records.

---

## System Architecture

```
                                  +-------------------------------+
                                  |      React 19 + Vite SPA      |
                                  |  (Tailwind v4, Recharts, WS)  |
                                  +---------------+---------------+
                                                  |
                                   HTTP / REST    |   WebSocket
                                                  v
                         +-------------------------------------------------+
                         |              Express REST & WS API              |
                         |           Node.js 20 / TypeScript               |
                         |  (Auth, Rate Limit, RBAC, Validation, Routers)  |
                         +-------+-------------+-------------+-------------+
                                 |             |             |
                +----------------+             |             +----------------+
                v                              v                              v
     +---------------------+        +---------------------+        +---------------------+
     │   PostgreSQL 16     │        │    Redis 7 Engine   │        │ Cloudinary Storage  │
     │     via Prisma      │        │  - Token Blacklist  │        │   (Raw Resume Files)│
     │  (Users, Sessions,  │        │  - Rate Limiting    │        +---------------------+
     │   Analyses, Audits) │        │  - BullMQ Queue     │
     +---------------------+        +----------+----------+
                                               |
                                               v
                                    +---------------------+
                                    │ BullMQ Worker Tasks │
                                    │ (Resume OCR & ATS)  │
                                    +----------+----------+
                                               |
                                               v
     +-----------------------------------------------------------------------------------+
     │                     Resilient AI Abstraction Layer                                │
     │  +-----------------+-----------------+-----------------+-----------------------+  │
     │  │ Google Gemini   │ Groq Fast Llama │ OpenAI GPT-4o   │ Anthropic Claude 3.5  │  │
     │  +-----------------+-----------------+-----------------+-----------------------+  │
     │     - Multi-provider fallback chain             - Audit logger & cost tracking    │
     │     - Zod schema validation & prompt registry   - Mock provider for local dev     │
     +-----------------------------------------------------------------------------------+
```

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend Runtime** | Node.js 20 LTS, TypeScript 5, Express |
| **Frontend Framework** | React 19, Vite 8, TypeScript |
| **Styling & Components** | Tailwind CSS v4, Lucide React, Framer Motion |
| **Realtime Gateway** | WebSockets (`ws`), Web Speech API |
| **Database & ORM** | PostgreSQL 16, Prisma ORM |
| **Queue & Cache** | Redis 7, BullMQ |
| **AI Providers** | Google Gemini, Groq, OpenAI, Anthropic Claude |
| **Document Processing** | `pdf-parse`, `mammoth` (DOCX), `tesseract.js` (OCR) |
| **Storage & Billing** | Cloudinary (resume file storage), Razorpay (subscriptions) |
| **Testing & Tooling** | Jest, Supertest, Oxlint |

---

## Directory Layout

```
interviewai-pro/
├── .env.example              # Backend environment template
├── docker-compose.yml        # Docker service configuration (Postgres, Redis)
├── Dockerfile                # Production backend container definition
├── package.json              # Backend package configuration
├── tsconfig.json             # Backend TypeScript configuration
├── jest.config.js            # Jest test configuration
├── prisma/
│   ├── schema.prisma         # Prisma data models and enums
│   └── migrations/           # Database migration files
├── src/
│   ├── app.ts                # Express application definition
│   ├── server.ts             # Server entrypoint and worker startup
│   ├── common/               # Middlewares, logger, errors, shared utilities
│   ├── config/               # Environment schema, Prisma, Redis, Cloudinary, Razorpay
│   ├── integrations/
│   │   ├── ai/               # Multi-provider AI abstraction, pricing, prompts, schemas
│   │   └── storage/          # Cloudinary storage provider
│   ├── jobs/                 # BullMQ queue and worker implementations
│   ├── modules/
│   │   ├── admin/            # Administrative metrics and audit logs
│   │   ├── analytics/        # Candidate analytics and scoring algorithms
│   │   ├── auth/             # Authentication, refresh token rotation, RBAC
│   │   ├── billing/          # Razorpay order processing and webhooks
│   │   ├── interview/        # Text-based adaptive interview engine
│   │   ├── job-match/        # Job description comparison and gap analysis
│   │   ├── realtime/         # Realtime agent logic and integrity checks
│   │   └── resume/           # Resume extraction, OCR, and ATS analysis
│   └── realtime/
│       └── websocket.server.ts # WebSocket server for live interview rooms
└── frontend/
    ├── .env.example          # Frontend environment template
    ├── index.html            # Vite HTML template
    ├── package.json          # Frontend package configuration
    ├── vite.config.ts        # Vite build and proxy configuration
    └── src/
        ├── main.tsx          # Frontend entrypoint
        ├── App.tsx           # Route layout and protection
        ├── components/       # UI components (Analytics, Billing, Interview, Resume, Layout)
        ├── lib/              # API clients, auth context, toast state, speech hooks
        └── pages/            # Views (Dashboard, Interviews, RealtimeRoom, Resumes, JobMatch, Billing)
```

---

## Getting Started

### Prerequisites
- Node.js 20.x or higher
- Docker Desktop (or local instances of PostgreSQL 16 and Redis 7)
- Git

---

### 1. Clone Repository
```bash
git clone https://github.com/yug0973/interviewai-pro.git
cd interviewai-pro
```

---

### 2. Backend Setup

#### Install dependencies
```bash
npm install
```

#### Configure environment variables
Create `.env` from the template:
```bash
cp .env.example .env
```
*(On Windows PowerShell, use `copy .env.example .env`)*

Configure settings in `.env`:
```env
# Database & Cache
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/interviewai_pro?schema=public"
REDIS_URL="redis://localhost:6379"

# Security
JWT_SECRET="your-secure-random-jwt-secret"
REFRESH_TOKEN_SECRET="your-secure-random-refresh-secret"

# AI Provider ("mock" | "gemini" | "groq" | "openai" | "anthropic")
AI_PROVIDER="mock"
GEMINI_API_KEY="your-gemini-key"      # Optional: https://aistudio.google.com/apikey
GROQ_API_KEY="your-groq-key"          # Optional: https://console.groq.com/keys

# Optional External Integrations
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
```

> The application defaults to `AI_PROVIDER=mock`, allowing complete local feature testing without requiring paid API keys or external services.

#### Start Database and Cache Containers
```bash
docker compose up -d postgres redis
```

#### Apply Database Migrations
```bash
npx prisma generate
npx prisma migrate dev
```

#### Run the Development Server
```bash
npm run dev
```
The server will start at `http://localhost:4000`. Health endpoints:
```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ai
```

---

### 3. Frontend Setup

In a separate terminal window:

#### Install dependencies
```bash
cd frontend
npm install
```

#### Configure environment variables
```bash
cp .env.example .env
```
*(On Windows PowerShell, use `copy .env.example .env`)*

Default `.env` configuration:
```env
VITE_API_BASE_URL=http://localhost:4000
VITE_WS_BASE_URL=ws://localhost:4000
```

#### Start Frontend Server
```bash
npm run dev
```
Access the application at `http://localhost:5173`.

---

## API Reference

| Module | Method & Path | Description |
|---|---|---|
| **Auth** | `POST /api/auth/signup` | Register new user account |
| | `POST /api/auth/login` | Authenticate and obtain JWT tokens |
| | `POST /api/auth/refresh` | Refresh access token |
| | `GET /api/auth/me` | Retrieve authenticated profile |
| **Resumes** | `POST /api/resumes` | Upload resume for background ATS analysis |
| | `GET /api/resumes` | List all user resumes with scores |
| | `GET /api/resumes/:id` | Retrieve full ATS analysis and rewrite advice |
| | `GET /api/resumes/compare` | Compare two resume versions side-by-side |
| **Interviews** | `POST /api/interviews` | Initialize adaptive interview session |
| | `POST /api/interviews/:id/answer` | Submit answer and receive follow-up question |
| | `GET /api/interviews/:id` | View transcript and evaluations |
| **Realtime** | `POST /api/realtime/sessions` | Initialize voice interview room session |
| | `WS /ws/interview` | WebSocket connection for streaming and integrity checks |
| **Job Match** | `POST /api/job-match` | Compare resume against job description |
| **Analytics** | `GET /api/analytics/dashboard` | Retrieve candidate performance trends and metrics |
| **Billing** | `GET /api/billing/plans` | Fetch subscription plan configurations |
| | `POST /api/billing/create-order` | Create Razorpay order |
| | `POST /api/billing/webhook` | Process Razorpay payment webhooks |
| **Admin** | `GET /api/admin/metrics` | Retrieve platform metrics and AI cost summaries |

---

## Testing

Run the automated test suite:
```bash
npm test
```

Run frontend linting:
```bash
cd frontend
npm run lint
```

---

## License

This project is licensed under the [MIT License](LICENSE).
