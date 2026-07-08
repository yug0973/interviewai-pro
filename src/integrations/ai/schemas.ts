import { z } from 'zod';

export const resumeRewriteSuggestionSchema = z.object({
  original: z.string().min(1),
  rewritten: z.string().min(1),
});

export const resumeAnalysisSchema = z.object({
  atsScore: z.number().min(0).max(100),
  summary: z.string().min(1),
  detectedRole: z.string().min(1),
  experienceLevel: z.enum(['entry', 'junior', 'mid', 'senior', 'lead']),
  skills: z.array(z.string()),
  technicalSkills: z.array(z.string()),
  softSkills: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  certifications: z.array(z.string()),
  educationReview: z.string().min(1),
  projectReview: z.string().min(1),
  experienceReview: z.string().min(1),
  grammarIssues: z.array(z.string()),
  formattingIssues: z.array(z.string()),
  strengths: z.array(z.string()).min(1),
  weaknesses: z.array(z.string()).min(1),
  suggestions: z.array(z.string()).min(1),
  rewriteSuggestions: z.array(resumeRewriteSuggestionSchema),
});

export const interviewQuestionSchema = z.object({
  question: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

export const answerEvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  idealAnswerSummary: z.string().min(1),
});

export const categoryScoreSchema = z.object({
  category: z.string().min(1),
  score: z.number().min(0).max(100),
  feedback: z.string(),
});

export const interviewSummarySchema = z.object({
  overallScore: z.number().min(0).max(100),
  categoryScores: z.array(categoryScoreSchema).optional(),
  strengths: z.array(z.string()).min(1),
  weaknesses: z.array(z.string()).min(1),
  recommendation: z.string().min(1),
  nextRecommendedTopic: z.string().optional(),
});

export const feedbackSchema = z.object({
  feedback: z.string().min(1),
  actionItems: z.array(z.string()).min(1),
});

export const jobMatchImprovementSchema = z.object({
  what: z.string().min(1),
  why: z.string().min(1),
  how: z.string().min(1),
});

export const likelyInterviewQuestionSchema = z.object({
  question: z.string().min(1),
  category: z.string().min(1),
  why: z.string().min(1),
});

export const jobMatchSchema = z.object({
  matchScore: z.number().min(0).max(100),
  roleTitle: z.string().min(1),
  experienceLevelMatch: z.string().min(1),
  summary: z.string().min(1),
  matchingSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  experienceGaps: z.array(z.string()),
  relevantProjects: z.array(z.string()),
  resumeImprovements: z.array(jobMatchImprovementSchema),
  likelyInterviewQuestions: z.array(likelyInterviewQuestionSchema),
});

export const realtimeAgentTurnSchema = z.object({
  aiResponse: z.string(),
  action: z.enum([
    'ASK_NEW_TOPIC',
    'ASK_FOLLOW_UP',
    'CHALLENGE_ANSWER',
    'ASK_CLARIFICATION',
    'CHANGE_DIFFICULTY',
    'CONCLUDE_INTERVIEW',
  ]),
  topic: z.string(),
  isFollowUp: z.boolean(),
  technicalDepth: z.number().min(1).max(10),
  confidenceScore: z.number().min(1).max(10),
  evaluationSnippet: z.string(),
  isInterviewComplete: z.boolean(),
});

export const realtimeEvaluationSchema = z.object({
  overallScore: z.number().min(0).max(100),
  technicalScore: z.number().min(0).max(100),
  problemSolvingScore: z.number().min(0).max(100),
  communicationScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  depthScore: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  technicalGaps: z.array(z.string()),
  communicationFeedback: z.string(),
  recommendedTopics: z.array(z.string()),
  evidenceSummary: z.string(),
  integritySummary: z.string(),
  integrityStatus: z.enum(['PASSED', 'FLAGGED', 'TERMINATED']),
});

/**
 * Strips think tags, markdown code fences, and extracts JSON objects/arrays,
 * then parses and validates with Zod schema.
 */
export function parseAndValidate<T>(rawText: string, schema: z.ZodSchema<T>): T {
  // Strip <think>...</think> tags emitted by reasoning models
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Strip markdown code fences if present
  cleaned = cleaned
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Extract outermost JSON structure if extra conversational chatter was included
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }

  const json = JSON.parse(cleaned);
  return schema.parse(json);
}
