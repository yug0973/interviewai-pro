const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "CANDIDATE" | "ADMIN";
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface PlanStatus {
  plan: "FREE" | "PRO";
  proExpiresAt: string | null;
  isPro: boolean;
}

export interface ResumeRewriteSuggestion {
  original: string;
  rewritten: string;
}

export interface ResumeAnalysis {
  atsScore: number;
  summary: string;
  detectedRole: string;
  experienceLevel: "entry" | "junior" | "mid" | "senior" | "lead";
  skills: string[];
  technicalSkills: string[];
  softSkills: string[];
  missingKeywords: string[];
  certifications: string[];
  educationReview: string;
  projectReview: string;
  experienceReview: string;
  grammarIssues: string[];
  formattingIssues: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  rewriteSuggestions: ResumeRewriteSuggestion[];
}

export interface Resume {
  id: string;
  userId: string;
  label: string;
  isPrimary: boolean;
  targetRole: string | null;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  failureReason: string | null;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  cloudinaryUrl: string;
  extractionMethod: string;
  extractedText: string | null;
  createdAt: string;
  updatedAt: string;
  analysis: ResumeAnalysis | null;
}

export interface ResumeComparisonResult {
  a: { resume: Resume; analysis: ResumeAnalysis };
  b: { resume: Resume; analysis: ResumeAnalysis };
  atsScoreDelta: number;
}

export interface JobMatchImprovement {
  what: string;
  why: string;
  how: string;
}

export interface LikelyInterviewQuestion {
  question: string;
  category: string;
  why: string;
}

export interface JobMatchResult {
  matchScore: number;
  roleTitle: string;
  experienceLevelMatch: string;
  summary: string;
  matchingSkills: string[];
  missingSkills: string[];
  missingKeywords: string[];
  experienceGaps: string[];
  relevantProjects: string[];
  resumeImprovements: JobMatchImprovement[];
  likelyInterviewQuestions: LikelyInterviewQuestion[];
}

export interface InterviewQuestion {
  id: string;
  order: number;
  questionText: string;
  category: string;
  difficulty: string;
  isFollowUp: boolean;
  answerText: string | null;
  answeredAt: string | null;
  score: number | null;
  evaluationStrengths: string[];
  evaluationImprovements: string[];
  idealAnswerSummary: string | null;
}

export interface CategoryScore {
  category: string;
  score: number;
  feedback: string;
}

export interface InterviewSession {
  id: string;
  userId: string;
  resumeId: string | null;
  targetRole: string;
  difficulty: string;
  mode: "TEXT" | "VOICE";
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  totalQuestions: number;
  overallScore: number | null;
  strengths: string[];
  weaknesses: string[];
  recommendation: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface InterviewSessionDetail extends InterviewSession {
  questions: InterviewQuestion[];
}

export interface TurnEvaluation {
  score: number;
  strengths: string[];
  improvements: string[];
  idealAnswerSummary: string;
}

export interface TurnResponse {
  session: InterviewSessionDetail;
  currentQuestion: InterviewQuestion | null;
  completed: boolean;
  evaluation?: TurnEvaluation;
}

export interface AnalyticsOverview {
  resumes: { total: number; analyzed: number; averageAtsScore: number | null };
  interviews: {
    total: number;
    inProgress: number;
    completed: number;
    abandoned: number;
    averageScore: number | null;
  };
}

export interface SkillGap {
  keyword: string;
  count: number;
}

export interface ResumeHistoryEntry {
  resumeId: string;
  label: string;
  isPrimary: boolean;
  atsScore: number;
  detectedRole: string;
  experienceLevel: string;
  missingKeywordCount: number;
  date: string;
}

export interface InterviewHistoryEntry {
  sessionId: string;
  targetRole: string;
  difficulty: string;
  mode: string;
  overallScore: number | null;
  totalQuestions: number;
  date: string | null;
}

export interface CreateOrderResponse {
  orderId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// ---------------- Token Storage & Refresh Queue ----------------

let currentAccessToken: string | null = localStorage.getItem("accessToken");
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

export function setStoredAccessToken(token: string | null) {
  currentAccessToken = token;
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
  }
}

export function getStoredAccessToken(): string | null {
  return currentAccessToken ?? localStorage.getItem("accessToken");
}

export async function getValidAccessToken(): Promise<string> {
  let token = getStoredAccessToken();
  if (!token) {
    token = await performTokenRefresh();
  }
  return token;
}

let onSessionExpiredCallback: (() => void) | null = null;
export function registerSessionExpiredHandler(cb: () => void) {
  onSessionExpiredCallback = cb;
}

async function performTokenRefresh(): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    setStoredAccessToken(null);
    if (onSessionExpiredCallback) onSessionExpiredCallback();
    throw new ApiError("Session expired. Please log in again.", 401, "SESSION_EXPIRED");
  }

  const data = (await res.json()) as { accessToken: string };
  setStoredAccessToken(data.accessToken);
  return data.accessToken;
}

export async function rawRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data?.error?.message ?? "Something went wrong. Try again.",
      res.status,
      data?.error?.code
    );
  }

  return data as T;
}

export async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let token = getStoredAccessToken();

  if (!token) {
    try {
      token = await performTokenRefresh();
    } catch {
      throw new ApiError("Not authenticated", 401, "NOT_LOGGED_IN");
    }
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Authorization") && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    // Attempt automatic refresh if not already refreshing this endpoint
    if (path.includes("/api/auth/refresh")) {
      setStoredAccessToken(null);
      throw new ApiError("Session expired", 401, "SESSION_EXPIRED");
    }

    if (isRefreshing) {
      // Queue this request
      return new Promise<T>((resolve, reject) => {
        refreshQueue.push({
          resolve: async (newToken: string) => {
            const retryHeaders = new Headers(init?.headers);
            retryHeaders.set("Authorization", `Bearer ${newToken}`);
            try {
              const retryRes = await fetch(`${API_URL}${path}`, {
                ...init,
                headers: retryHeaders,
                credentials: "include",
              });
              if (retryRes.status === 204) return resolve(undefined as T);
              const data = await retryRes.json().catch(() => ({}));
              if (!retryRes.ok) {
                return reject(new ApiError(data?.error?.message ?? "Request failed", retryRes.status, data?.error?.code));
              }
              resolve(data as T);
            } catch (err) {
              reject(err);
            }
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    try {
      const newToken = await performTokenRefresh();
      // Replay queued requests
      const queue = refreshQueue;
      refreshQueue = [];
      queue.forEach((p) => p.resolve(newToken));

      // Retry current request
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      const retryRes = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: retryHeaders,
        credentials: "include",
      });
      if (retryRes.status === 204) return undefined as T;
      const data = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) {
        throw new ApiError(data?.error?.message ?? "Request failed", retryRes.status, data?.error?.code);
      }
      return data as T;
    } catch (err) {
      const queue = refreshQueue;
      refreshQueue = [];
      queue.forEach((p) => p.reject(err));
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data?.error?.message ?? "Something went wrong. Try again.",
      res.status,
      data?.error?.code
    );
  }

  return data as T;
}

// ---------------- API Methods ----------------

export const authApi = {
  signup: (payload: SignupPayload) =>
    rawRequest<AuthResponse>("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginPayload) =>
    rawRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  refresh: () => performTokenRefresh(),

  logout: async () => {
    try {
      await rawRequest<void>("/api/auth/logout", { method: "POST" });
    } finally {
      setStoredAccessToken(null);
    }
  },

  me: () => authedRequest<{ user: AuthUser }>("/api/auth/me"),
};

export const resumeApi = {
  list: () => authedRequest<{ resumes: Resume[] }>("/api/resumes"),

  get: (id: string) => authedRequest<{ resume: Resume }>(`/api/resumes/${id}`),

  upload: (file: File, opts: { label?: string; targetRole?: string; isPrimary?: boolean }) => {
    const form = new FormData();
    form.append("resume", file);
    if (opts.label) form.append("label", opts.label);
    if (opts.targetRole) form.append("targetRole", opts.targetRole);
    if (opts.isPrimary) form.append("isPrimary", "true");

    return authedRequest<{ resume: Resume }>("/api/resumes", {
      method: "POST",
      body: form,
    });
  },

  setPrimary: (id: string) =>
    authedRequest<{ resume: Resume }>(`/api/resumes/${id}/primary`, { method: "PATCH" }),

  remove: (id: string) => authedRequest<void>(`/api/resumes/${id}`, { method: "DELETE" }),

  compare: (resumeIdA: string, resumeIdB: string) =>
    authedRequest<ResumeComparisonResult>(`/api/resumes/compare?a=${resumeIdA}&b=${resumeIdB}`),
};

export const jobMatchApi = {
  match: (payload: { resumeId?: string; resumeText?: string; jobDescriptionText: string; targetRole?: string }) =>
    authedRequest<{ match: JobMatchResult }>("/api/job-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};

export interface StartInterviewPayload {
  targetRole?: string;
  resumeId?: string;
  difficulty?: "easy" | "medium" | "hard";
  totalQuestions?: number;
  mode?: "TEXT" | "VOICE";
  focus?: "mixed" | "dsa" | "backend" | "system_design" | "behavioral" | "frontend" | "devops";
  topics?: string[];
}

export const interviewSessionApi = {
  list: () => authedRequest<{ sessions: InterviewSession[] }>("/api/interviews"),

  start: (payload: StartInterviewPayload) =>
    authedRequest<TurnResponse>("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  get: (id: string) => authedRequest<{ session: InterviewSessionDetail }>(`/api/interviews/${id}`),

  answer: (id: string, answerText: string) =>
    authedRequest<TurnResponse>(`/api/interviews/${id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerText }),
    }),

  abandon: (id: string) =>
    authedRequest<{ session: InterviewSessionDetail }>(`/api/interviews/${id}/abandon`, {
      method: "POST",
    }),
};

export const analyticsApi = {
  overview: () => authedRequest<AnalyticsOverview>("/api/analytics/overview"),
  skillGaps: () => authedRequest<{ skillGaps: SkillGap[] }>("/api/analytics/skill-gaps"),
  resumeHistory: () =>
    authedRequest<{ history: ResumeHistoryEntry[] }>("/api/analytics/resumes/history"),
  interviewHistory: () =>
    authedRequest<{ history: InterviewHistoryEntry[] }>("/api/analytics/interviews/history"),
};

export const billingApi = {
  status: () => authedRequest<PlanStatus>("/api/billing/status"),

  createOrder: () =>
    authedRequest<CreateOrderResponse>("/api/billing/orders", { method: "POST" }),

  verify: (payload: VerifyPaymentPayload) =>
    authedRequest<{ plan: "FREE" | "PRO"; proExpiresAt: string | null }>(
      "/api/billing/orders/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    ),
};

export interface RealtimeMessage {
  id: string;
  speaker: "AI" | "CANDIDATE";
  text: string;
  order: number;
  topic?: string;
  isFollowUp?: boolean;
  technicalDepth?: number;
  confidenceScore?: number;
  createdAt: string;
}

export interface RealtimeIntegrityEvent {
  id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  createdAt: string;
}

export interface RealtimeEvaluation {
  id: string;
  overallScore: number;
  technicalScore: number;
  problemSolvingScore: number;
  communicationScore: number;
  confidenceScore: number;
  depthScore: number;
  strengths: string[];
  weaknesses: string[];
  technicalGaps: string[];
  communicationFeedback: string;
  recommendedTopics: string[];
  evidenceSummary: string;
  integritySummary: string;
  createdAt: string;
}

export interface RealtimeSessionDetail {
  id: string;
  userId: string;
  targetRole: string;
  interviewType: string;
  difficulty: string;
  mode: string;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED" | "TERMINATED";
  roomState: string;
  warningCount: number;
  maxWarnings: number;
  integrityStatus: "PASSED" | "FLAGGED" | "TERMINATED";
  terminationReason?: string | null;
  overallScore?: number | null;
  strengths: string[];
  weaknesses: string[];
  messages: RealtimeMessage[];
  events: RealtimeIntegrityEvent[];
  evaluation?: RealtimeEvaluation | null;
  resume?: { id: string; label: string } | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface StartRealtimePayload {
  targetRole: string;
  interviewType?: "technical" | "behavioral" | "system_design" | "mixed" | "coding" | "hr" | "dsa" | "backend";
  difficulty?: "easy" | "medium" | "hard";
  resumeId?: string;
  jobDescriptionText?: string;
}

export const realtimeApi = {
  create: (payload: StartRealtimePayload) =>
    authedRequest<{ session: RealtimeSessionDetail; wsPath: string }>(
      "/api/realtime/sessions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    ),

  get: (id: string) =>
    authedRequest<{ session: RealtimeSessionDetail }>(`/api/realtime/sessions/${id}`),

  finalize: (id: string) =>
    authedRequest<{ evaluation: RealtimeEvaluation }>(`/api/realtime/sessions/${id}/finalize`, {
      method: "POST",
    }),
};

