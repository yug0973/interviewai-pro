/**
 * The single contract every AI-touching feature in this app depends on.
 * No module should ever import a provider SDK (Gemini/Groq/OpenAI) directly -
 * only this interface. Swapping providers, adding a new one, or falling back
 * between them should never require touching Resume/Interview/Evaluation code.
 */

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Standardized envelope every provider method returns, regardless of vendor. */
export interface AIResult<T> {
  data: T;
  usage: AIUsage;
  costUsd: number;
  provider: string;
  model: string;
  latencyMs: number;
}

export type AIOperation =
  | 'analyzeResume'
  | 'generateInterviewQuestion'
  | 'evaluateAnswer'
  | 'generateFollowUpQuestion'
  | 'summarizeInterview'
  | 'generateFeedback'
  | 'matchJobDescription'
  | 'realtimeAgentTurn'
  | 'evaluateRealtimeInterview';

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly operation: AIOperation,
    /** Whether retrying this exact request is likely to help (timeouts, 429s, 5xxs). */
    public readonly retryable: boolean,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

// ---------- analyzeResume ----------

export interface AnalyzeResumeInput {
  resumeText: string;
  targetRole?: string;
}

export type ExperienceLevel = 'entry' | 'junior' | 'mid' | 'senior' | 'lead';

export interface ResumeRewriteSuggestion {
  original: string;
  rewritten: string;
}

export interface ResumeAnalysisResult {
  atsScore: number; // 0-100
  summary: string;
  detectedRole: string;
  experienceLevel: ExperienceLevel;
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

// ---------- generateInterviewQuestion ----------

export interface GenerateQuestionInput {
  role: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topics?: string[];
  previousQuestions?: string[];
  candidateSkills?: string[];
}

export interface InterviewQuestionResult {
  question: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// ---------- evaluateAnswer ----------

export interface EvaluateAnswerInput {
  question: string;
  answerText: string;
  role: string;
}

export interface AnswerEvaluationResult {
  score: number; // 0-100
  strengths: string[];
  improvements: string[];
  idealAnswerSummary: string;
}

// ---------- generateFollowUpQuestion ----------

export interface FollowUpInput {
  originalQuestion: string;
  candidateAnswer: string;
  role: string;
  /** The score (0-100) evaluateAnswer() just gave this exact answer, if available - lets the follow-up genuinely adapt. */
  previousScore?: number;
  /** The specific gaps evaluateAnswer() identified in this answer, if available. */
  previousImprovements?: string[];
}

// ---------- summarizeInterview ----------

export interface SummarizeInterviewInput {
  role: string;
  qaPairs: Array<{ question: string; answer: string; score?: number }>;
}

export interface CategoryScore {
  category: string;
  score: number; // 0-100
  feedback: string;
}

export interface InterviewSummaryResult {
  overallScore: number; // 0-100
  categoryScores?: CategoryScore[];
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  nextRecommendedTopic?: string;
}

// ---------- generateFeedback ----------

export interface GenerateFeedbackInput {
  context: string; // free-form: could be a resume, an answer, a full interview summary
  focusAreas?: string[];
}

export interface FeedbackResult {
  feedback: string;
  actionItems: string[];
}

// ---------- matchJobDescription ----------

export interface MatchJobDescriptionInput {
  resumeText: string;
  jobDescriptionText: string;
  targetRole?: string;
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
  matchScore: number; // 0-100
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

// ---------- realtimeAgentTurn ----------

export type RealtimeAgentAction =
  | 'ASK_NEW_TOPIC'
  | 'ASK_FOLLOW_UP'
  | 'CHALLENGE_ANSWER'
  | 'ASK_CLARIFICATION'
  | 'CHANGE_DIFFICULTY'
  | 'CONCLUDE_INTERVIEW';

export interface RealtimeAgentTurnInput {
  role: string;
  difficulty: 'easy' | 'medium' | 'hard';
  interviewType: string;
  candidateSpeech: string;
  conversationHistory: Array<{
    speaker: 'AI' | 'CANDIDATE';
    text: string;
    topic?: string;
    isFollowUp?: boolean;
  }>;
  resumeSkills?: string[];
  resumeProjects?: string[];
  jobDescription?: string;
  questionsCount: number;
  currentTopic?: string;
  currentTopicDepth?: number;
}

export interface RealtimeAgentTurnResult {
  aiResponse: string; // The exact spoken response from the AI interviewer
  action: RealtimeAgentAction;
  topic: string;
  isFollowUp: boolean;
  technicalDepth: number; // 1-10
  confidenceScore: number; // 1-10
  evaluationSnippet: string;
  isInterviewComplete: boolean;
}

// ---------- evaluateRealtimeInterview ----------

export interface RealtimeEvaluationInput {
  role: string;
  interviewType: string;
  messages: Array<{
    speaker: 'AI' | 'CANDIDATE';
    text: string;
    topic?: string;
    isFollowUp?: boolean;
  }>;
  integrityEvents: Array<{
    type: string;
    severity: string;
    reason: string;
    createdAt?: string | Date;
  }>;
  warningCount: number;
}

export interface RealtimeEvaluationResult {
  overallScore: number; // 0-100
  technicalScore: number; // 0-100
  problemSolvingScore: number; // 0-100
  communicationScore: number; // 0-100
  confidenceScore: number; // 0-100
  depthScore: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  technicalGaps: string[];
  communicationFeedback: string;
  recommendedTopics: string[];
  evidenceSummary: string;
  integritySummary: string;
  integrityStatus: 'PASSED' | 'FLAGGED' | 'TERMINATED';
}

/**
 * The contract itself. Every concrete provider (Gemini, Groq, OpenAI, Anthropic, Mock)
 * implements this exactly, and the instrumentation wrapper also implements
 * it so callers can't tell the difference between a raw and wrapped provider.
 */
export interface AIProvider {
  readonly name: string;

  analyzeResume(input: AnalyzeResumeInput): Promise<AIResult<ResumeAnalysisResult>>;
  generateInterviewQuestion(
    input: GenerateQuestionInput
  ): Promise<AIResult<InterviewQuestionResult>>;
  evaluateAnswer(input: EvaluateAnswerInput): Promise<AIResult<AnswerEvaluationResult>>;
  generateFollowUpQuestion(input: FollowUpInput): Promise<AIResult<InterviewQuestionResult>>;
  summarizeInterview(input: SummarizeInterviewInput): Promise<AIResult<InterviewSummaryResult>>;
  generateFeedback(input: GenerateFeedbackInput): Promise<AIResult<FeedbackResult>>;
  matchJobDescription(input: MatchJobDescriptionInput): Promise<AIResult<JobMatchResult>>;
  realtimeAgentTurn(input: RealtimeAgentTurnInput): Promise<AIResult<RealtimeAgentTurnResult>>;
  evaluateRealtimeInterview(
    input: RealtimeEvaluationInput
  ): Promise<AIResult<RealtimeEvaluationResult>>;

  /** Cheap connectivity/credential check - used by a /health/ai endpoint. */
  healthCheck(): Promise<boolean>;
}
