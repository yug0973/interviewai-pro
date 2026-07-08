import { prisma } from '../../config/prisma';
import type { InterviewSessionStatus } from '@prisma/client';

export interface CreateSessionData {
  userId: string;
  resumeId?: string;
  targetRole: string;
  difficulty: string;
  totalQuestions: number;
  mode: string;
}

export interface CreateQuestionData {
  sessionId: string;
  order: number;
  questionText: string;
  category: string;
  difficulty: string;
  isFollowUp: boolean;
}

export interface CompleteSessionData {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}

export interface SaveEvaluationData {
  score: number;
  strengths: string[];
  improvements: string[];
  idealAnswerSummary: string;
}

export const interviewRepository = {
  createSession(data: CreateSessionData) {
    return prisma.interviewSession.create({ data });
  },

  findSessionByIdForUser(id: string, userId: string) {
    return prisma.interviewSession.findFirst({
      where: { id, userId },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
  },

  findAllSessionsForUser(userId: string) {
    return prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  countSessionsThisMonth(userId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    return prisma.interviewSession.count({ where: { userId, createdAt: { gte: startOfMonth } } });
  },

  updateSessionStatus(id: string, status: InterviewSessionStatus) {
    return prisma.interviewSession.update({ where: { id }, data: { status } });
  },

  completeSession(id: string, data: CompleteSessionData) {
    return prisma.interviewSession.update({
      where: { id },
      data: {
        ...data,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  },

  createQuestion(data: CreateQuestionData) {
    return prisma.interviewQuestion.create({ data });
  },

  findLatestUnansweredQuestion(sessionId: string) {
    return prisma.interviewQuestion.findFirst({
      where: { sessionId, answerText: null },
      orderBy: { order: 'desc' },
    });
  },

  answerQuestion(id: string, answerText: string) {
    return prisma.interviewQuestion.update({
      where: { id },
      data: { answerText, answeredAt: new Date() },
    });
  },

  saveEvaluation(id: string, data: SaveEvaluationData) {
    return prisma.interviewQuestion.update({
      where: { id },
      data: {
        score: Math.round(data.score),
        evaluationStrengths: data.strengths,
        evaluationImprovements: data.improvements,
        idealAnswerSummary: data.idealAnswerSummary,
      },
    });
  },

  findAnsweredQuestions(sessionId: string) {
    return prisma.interviewQuestion.findMany({
      where: { sessionId, answerText: { not: null } },
      orderBy: { order: 'asc' },
    });
  },
};