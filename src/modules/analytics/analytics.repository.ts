import { prisma } from '../../config/prisma';

export const analyticsRepository = {
  /** ATS score over time, one point per resume that has finished analysis. */
  findResumeAtsHistory(userId: string) {
    return prisma.resumeAnalysis.findMany({
      where: { resume: { userId } },
      orderBy: { createdAt: 'asc' },
      select: {
        atsScore: true,
        detectedRole: true,
        experienceLevel: true,
        missingKeywords: true,
        createdAt: true,
        resume: { select: { id: true, label: true, isPrimary: true } },
      },
    });
  },

  /** Interview overallScore over time, one point per completed session. */
  findInterviewScoreHistory(userId: string) {
    return prisma.interviewSession.findMany({
      where: { userId, status: 'COMPLETED' },
      orderBy: { completedAt: 'asc' },
      select: {
        id: true,
        targetRole: true,
        difficulty: true,
        mode: true,
        overallScore: true,
        totalQuestions: true,
        completedAt: true,
      },
    });
  },

  /** Raw missingKeywords arrays across all of a user's analyzed resumes - aggregated in the service. */
  async findAllMissingKeywords(userId: string): Promise<string[][]> {
    const analyses = await prisma.resumeAnalysis.findMany({
      where: { resume: { userId } },
      select: { missingKeywords: true },
    });
    return analyses.map((a: { missingKeywords: string[] }) => a.missingKeywords);
  },

  countResumes(userId: string) {
    return prisma.resume.count({ where: { userId } });
  },

  aggregateResumeAtsScores(userId: string) {
    return prisma.resumeAnalysis.aggregate({
      where: { resume: { userId } },
      _avg: { atsScore: true },
      _count: true,
    });
  },

  countInterviewSessionsByStatus(userId: string) {
    return prisma.interviewSession.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });
  },

  aggregateInterviewScores(userId: string) {
    return prisma.interviewSession.aggregate({
      where: { userId, status: 'COMPLETED' },
      _avg: { overallScore: true },
      _count: true,
    });
  },
};