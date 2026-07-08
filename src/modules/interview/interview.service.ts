import { interviewRepository } from './interview.repository';
import { resumeRepository } from '../resume/resume.repository';
import { authRepository } from '../auth/auth.repository';
import { isProActive } from '../billing/plan.util';
import { aiProvider } from '../../integrations/ai/ai.factory';
import { AIProviderError } from '../../integrations/ai/types';
import { AppError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';
import { env } from '../../config/env';
import type { StartInterviewInput } from './interview.schema';
import type { ExperienceLevel } from '../../integrations/ai/types';

type Difficulty = 'easy' | 'medium' | 'hard';

const DEFAULT_TOTAL_QUESTIONS = 5;
const DEFAULT_DIFFICULTY: Difficulty = 'medium';

const EXPERIENCE_LEVEL_TO_DIFFICULTY: Record<ExperienceLevel, Difficulty> = {
  entry: 'easy',
  junior: 'easy',
  mid: 'medium',
  senior: 'hard',
  lead: 'hard',
};

const FOCUS_TO_TOPICS: Record<string, string[]> = {
  mixed: ['System Design', 'Algorithms', 'Core Fundamentals', 'Behavioral'],
  dsa: ['Data Structures', 'Algorithms', 'Time & Space Complexity', 'Optimization'],
  backend: ['REST/GraphQL APIs', 'Database Indexing & Queries', 'Caching & In-Memory Storage', 'Asynchronous Queues'],
  system_design: ['High Availability & Scalability', 'Distributed Systems', 'Load Balancing & Partitioning', 'Data Consistency & Replication'],
  behavioral: ['Leadership & Ownership', 'Handling Production Incidents', 'Cross-functional Collaboration', 'Conflict Resolution'],
  frontend: ['Component Architecture', 'State Management & Reactivity', 'Web Performance & Core Web Vitals', 'Accessibility'],
  devops: ['CI/CD Pipelines', 'Container Orchestration & Kubernetes', 'Infrastructure as Code & Cloud', 'Observability & Monitoring'],
};

async function assertWithinFreeSessionLimit(userId: string): Promise<void> {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }
  if (isProActive(user)) return;

  const count = await interviewRepository.countSessionsThisMonth(userId);
  if (count >= env.FREE_INTERVIEWS_PER_MONTH) {
    throw AppError.forbidden(
      `Free plan allows ${env.FREE_INTERVIEWS_PER_MONTH} interview sessions per month. Upgrade to Pro for unlimited interviews.`,
      'FREE_TIER_LIMIT_REACHED'
    );
  }
}

async function callAI<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AIProviderError) {
      logger.error('AI call failed during interview flow', {
        operation: err.operation,
        provider: err.provider,
        retryable: err.retryable,
        message: err.message,
      });
      throw AppError.serviceUnavailable(
        "The AI interviewer is temporarily unavailable. Please try again in a moment - your progress hasn't been lost.",
        'AI_UNAVAILABLE'
      );
    }
    throw err;
  }
}

export const interviewService = {
  async startSession(userId: string, input: StartInterviewInput) {
    await assertWithinFreeSessionLimit(userId);

    let targetRole = input.targetRole;
    let difficulty = input.difficulty;
    let candidateSkills: string[] | undefined;

    if (input.resumeId) {
      const resume = await resumeRepository.findByIdForUser(input.resumeId, userId);
      if (!resume) {
        throw AppError.notFound('Resume not found', 'RESUME_NOT_FOUND');
      }
      targetRole ??= resume.analysis?.detectedRole ?? resume.targetRole ?? undefined;
      if (!difficulty && resume.analysis) {
        difficulty = EXPERIENCE_LEVEL_TO_DIFFICULTY[resume.analysis.experienceLevel as ExperienceLevel];
      }
      if (resume.analysis?.technicalSkills?.length) {
        candidateSkills = resume.analysis.technicalSkills;
      }
    }

    if (!targetRole) {
      throw AppError.badRequest(
        'Could not determine a target role. Provide targetRole explicitly, or link a resume that has completed ATS analysis.',
        'TARGET_ROLE_UNRESOLVED'
      );
    }

    difficulty ??= DEFAULT_DIFFICULTY;
    const totalQuestions = input.totalQuestions ?? DEFAULT_TOTAL_QUESTIONS;
    const mode = input.mode ?? 'TEXT';

    const topics = input.topics ?? (input.focus ? FOCUS_TO_TOPICS[input.focus] : undefined);

    const result = await callAI(() =>
      aiProvider.generateInterviewQuestion({
        role: targetRole,
        difficulty,
        topics,
        candidateSkills,
        previousQuestions: [],
      })
    );

    const session = await interviewRepository.createSession({
      userId,
      resumeId: input.resumeId,
      targetRole,
      difficulty,
      totalQuestions,
      mode,
    });

    const question = await interviewRepository.createQuestion({
      sessionId: session.id,
      order: 1,
      questionText: result.data.question,
      category: result.data.category,
      difficulty: result.data.difficulty,
      isFollowUp: false,
    });

    logger.info('Interview session started', { sessionId: session.id, userId, targetRole, difficulty, mode });

    // Return session populated with the opening question
    const freshSession = await interviewRepository.findSessionByIdForUser(session.id, userId);

    return { session: freshSession ?? session, currentQuestion: question, completed: false as const };
  },

  async submitAnswer(userId: string, sessionId: string, answerText: string) {
    const session = await interviewRepository.findSessionByIdForUser(sessionId, userId);
    if (!session) {
      throw AppError.notFound('Interview session not found', 'SESSION_NOT_FOUND');
    }
    if (session.status !== 'IN_PROGRESS') {
      throw AppError.badRequest('This interview session has already ended', 'SESSION_NOT_IN_PROGRESS');
    }

    const currentQuestion = await interviewRepository.findLatestUnansweredQuestion(sessionId);
    if (!currentQuestion) {
      throw AppError.conflict(
        'No open question to answer on this session',
        'NO_OPEN_QUESTION'
      );
    }

    await interviewRepository.answerQuestion(currentQuestion.id, answerText);

    const evaluation = await callAI(() =>
      aiProvider.evaluateAnswer({
        question: currentQuestion.questionText,
        answerText,
        role: session.targetRole,
      })
    );

    await interviewRepository.saveEvaluation(currentQuestion.id, {
      score: evaluation.data.score,
      strengths: evaluation.data.strengths,
      improvements: evaluation.data.improvements,
      idealAnswerSummary: evaluation.data.idealAnswerSummary,
    });

    if (currentQuestion.order >= session.totalQuestions) {
      return this.finalizeSession(userId, session.id, session.targetRole);
    }

    const followUp = await callAI(() =>
      aiProvider.generateFollowUpQuestion({
        originalQuestion: currentQuestion.questionText,
        candidateAnswer: answerText,
        role: session.targetRole,
        previousScore: evaluation.data.score,
        previousImprovements: evaluation.data.improvements,
      })
    );

    const nextQuestion = await interviewRepository.createQuestion({
      sessionId,
      order: currentQuestion.order + 1,
      questionText: followUp.data.question,
      category: followUp.data.category,
      difficulty: followUp.data.difficulty,
      isFollowUp: true,
    });

    const updatedSession = await interviewRepository.findSessionByIdForUser(sessionId, userId);

    return {
      session: updatedSession ?? session,
      currentQuestion: nextQuestion,
      completed: false as const,
      evaluation: {
        score: evaluation.data.score,
        strengths: evaluation.data.strengths,
        improvements: evaluation.data.improvements,
        idealAnswerSummary: evaluation.data.idealAnswerSummary,
      },
    };
  },

  async finalizeSession(userId: string, sessionId: string, targetRole: string) {
    const answered = await interviewRepository.findAnsweredQuestions(sessionId);

    const summary = await callAI(() =>
      aiProvider.summarizeInterview({
        role: targetRole,
        qaPairs: answered.map(
          (q: { questionText: string; answerText: string | null; score: number | null }) => ({
            question: q.questionText,
            answer: q.answerText ?? '',
            score: q.score ?? undefined,
          })
        ),
      })
    );

    await interviewRepository.completeSession(sessionId, {
      overallScore: Math.round(summary.data.overallScore),
      strengths: summary.data.strengths,
      weaknesses: summary.data.weaknesses,
      recommendation: summary.data.recommendation,
    });

    logger.info('Interview session completed', { sessionId, overallScore: summary.data.overallScore });

    const completedSession = await interviewRepository.findSessionByIdForUser(sessionId, userId);

    return { session: completedSession, currentQuestion: null, completed: true as const };
  },

  async listSessions(userId: string) {
    return interviewRepository.findAllSessionsForUser(userId);
  },

  async getSession(userId: string, sessionId: string) {
    const session = await interviewRepository.findSessionByIdForUser(sessionId, userId);
    if (!session) {
      throw AppError.notFound('Interview session not found', 'SESSION_NOT_FOUND');
    }
    return session;
  },

  async abandonSession(userId: string, sessionId: string) {
    const session = await interviewRepository.findSessionByIdForUser(sessionId, userId);
    if (!session) {
      throw AppError.notFound('Interview session not found', 'SESSION_NOT_FOUND');
    }
    if (session.status !== 'IN_PROGRESS') {
      throw AppError.badRequest('This interview session has already ended', 'SESSION_NOT_IN_PROGRESS');
    }
    return interviewRepository.updateSessionStatus(sessionId, 'ABANDONED');
  },
};