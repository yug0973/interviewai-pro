import { analyticsRepository } from './analytics.repository';

const TOP_SKILL_GAPS_LIMIT = 15;

export const analyticsService = {
  async getResumeAtsHistory(userId: string) {
    const rows = await analyticsRepository.findResumeAtsHistory(userId);
    return rows.map(
      (row: {
        atsScore: number;
        detectedRole: string;
        experienceLevel: string;
        missingKeywords: string[];
        createdAt: Date;
        resume: { id: string; label: string; isPrimary: boolean };
      }) => ({
        resumeId: row.resume.id,
        label: row.resume.label,
        isPrimary: row.resume.isPrimary,
        atsScore: row.atsScore,
        detectedRole: row.detectedRole,
        experienceLevel: row.experienceLevel,
        missingKeywordCount: row.missingKeywords.length,
        date: row.createdAt,
      })
    );
  },

  async getInterviewScoreHistory(userId: string) {
    const rows = await analyticsRepository.findInterviewScoreHistory(userId);
    return rows.map(
      (row: {
        id: string;
        targetRole: string;
        difficulty: string;
        mode: string;
        overallScore: number | null;
        totalQuestions: number;
        completedAt: Date | null;
      }) => ({
        sessionId: row.id,
        targetRole: row.targetRole,
        difficulty: row.difficulty,
        mode: row.mode,
        overallScore: row.overallScore,
        totalQuestions: row.totalQuestions,
        date: row.completedAt,
      })
    );
  },

  /**
   * Flattens every resume analysis' missingKeywords array across the user's
   * whole resume history and ranks which keywords come up most often - i.e.
   * "these are the skills you keep getting dinged for not having".
   */
  async getSkillGaps(userId: string) {
    const keywordLists = await analyticsRepository.findAllMissingKeywords(userId);

    const frequency = new Map<string, number>();
    for (const keywords of keywordLists) {
      for (const keyword of keywords) {
        const normalized = keyword.trim().toLowerCase();
        if (!normalized) continue;
        frequency.set(normalized, (frequency.get(normalized) ?? 0) + 1);
      }
    }

    return Array.from(frequency.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_SKILL_GAPS_LIMIT);
  },

  async getOverview(userId: string) {
    const [resumeCount, resumeAtsAgg, interviewStatusCounts, interviewScoreAgg] = await Promise.all([
      analyticsRepository.countResumes(userId),
      analyticsRepository.aggregateResumeAtsScores(userId),
      analyticsRepository.countInterviewSessionsByStatus(userId),
      analyticsRepository.aggregateInterviewScores(userId),
    ]);

    const statusBreakdown: Record<'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED', number> = {
      IN_PROGRESS: 0,
      COMPLETED: 0,
      ABANDONED: 0,
    };
    for (const row of interviewStatusCounts as Array<{ status: keyof typeof statusBreakdown; _count: number }>) {
      statusBreakdown[row.status] = row._count;
    }

    return {
      resumes: {
        total: resumeCount,
        analyzed: resumeAtsAgg._count,
        averageAtsScore: resumeAtsAgg._avg.atsScore !== null ? Math.round(resumeAtsAgg._avg.atsScore) : null,
      },
      interviews: {
        total: statusBreakdown.IN_PROGRESS + statusBreakdown.COMPLETED + statusBreakdown.ABANDONED,
        inProgress: statusBreakdown.IN_PROGRESS,
        completed: statusBreakdown.COMPLETED,
        abandoned: statusBreakdown.ABANDONED,
        averageScore:
          interviewScoreAgg._avg.overallScore !== null ? Math.round(interviewScoreAgg._avg.overallScore) : null,
      },
    };
  },
};