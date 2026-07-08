import request from 'supertest';
import { createApp } from '../../app';
import { analyticsRepository } from './analytics.repository';
import { signAccessToken } from '../../common/utils/jwt';

jest.mock('./analytics.repository');
jest.mock('../../config/prisma', () => ({ prisma: {} }));
jest.mock('../../config/redis', () => ({
  redis: {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  },
}));

const mockedRepo = analyticsRepository as jest.Mocked<typeof analyticsRepository>;

const app = createApp();

const USER_ID = 'user-1';
const accessToken = signAccessToken({ sub: USER_ID, role: 'CANDIDATE' as any });
const authHeader = `Bearer ${accessToken}`;

describe('Analytics module', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/analytics/overview');
    expect(res.status).toBe(401);
  });

  describe('GET /api/analytics/resumes/history', () => {
    it('shapes resume analysis rows into a score-over-time series', async () => {
      mockedRepo.findResumeAtsHistory.mockResolvedValueOnce([
        {
          atsScore: 72,
          detectedRole: 'Backend Engineer',
          experienceLevel: 'entry',
          missingKeywords: ['CI/CD', 'Docker'],
          createdAt: new Date('2026-06-01'),
          resume: { id: 'r1', label: 'v1', isPrimary: false },
        },
      ] as any);

      const res = await request(app)
        .get('/api/analytics/resumes/history')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.history).toEqual([
        {
          resumeId: 'r1',
          label: 'v1',
          isPrimary: false,
          atsScore: 72,
          detectedRole: 'Backend Engineer',
          experienceLevel: 'entry',
          missingKeywordCount: 2,
          date: '2026-06-01T00:00:00.000Z',
        },
      ]);
    });
  });

  describe('GET /api/analytics/interviews/history', () => {
    it('shapes completed sessions into a score-over-time series', async () => {
      mockedRepo.findInterviewScoreHistory.mockResolvedValueOnce([
        {
          id: 's1',
          targetRole: 'Backend Engineer',
          difficulty: 'medium',
          mode: 'TEXT',
          overallScore: 71,
          totalQuestions: 5,
          completedAt: new Date('2026-07-01'),
        },
      ] as any);

      const res = await request(app)
        .get('/api/analytics/interviews/history')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.history[0]).toMatchObject({ sessionId: 's1', overallScore: 71 });
    });
  });

  describe('GET /api/analytics/skill-gaps', () => {
    it('ranks missing keywords by frequency across all resumes, case-insensitively', async () => {
      mockedRepo.findAllMissingKeywords.mockResolvedValueOnce([
        ['CI/CD', 'Docker'],
        ['ci/cd', 'Kubernetes'],
        ['CI/CD'],
      ]);

      const res = await request(app)
        .get('/api/analytics/skill-gaps')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.skillGaps[0]).toEqual({ keyword: 'ci/cd', count: 3 });
      expect(res.body.skillGaps).toEqual(
        expect.arrayContaining([
          { keyword: 'ci/cd', count: 3 },
          { keyword: 'docker', count: 1 },
          { keyword: 'kubernetes', count: 1 },
        ])
      );
    });

    it('returns an empty list when there are no analyzed resumes', async () => {
      mockedRepo.findAllMissingKeywords.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/analytics/skill-gaps')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.skillGaps).toEqual([]);
    });
  });

  describe('GET /api/analytics/overview', () => {
    it('aggregates resume and interview stats into one summary', async () => {
      mockedRepo.countResumes.mockResolvedValueOnce(3);
      mockedRepo.aggregateResumeAtsScores.mockResolvedValueOnce({
        _avg: { atsScore: 68.4 },
        _count: 2,
      } as any);
      mockedRepo.countInterviewSessionsByStatus.mockResolvedValueOnce([
        { status: 'COMPLETED', _count: 4 },
        { status: 'IN_PROGRESS', _count: 1 },
      ] as any);
      mockedRepo.aggregateInterviewScores.mockResolvedValueOnce({
        _avg: { overallScore: 74.6 },
        _count: 4,
      } as any);

      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        resumes: { total: 3, analyzed: 2, averageAtsScore: 68 },
        interviews: { total: 5, inProgress: 1, completed: 4, abandoned: 0, averageScore: 75 },
      });
    });

    it('returns null averages instead of NaN when there is no data yet', async () => {
      mockedRepo.countResumes.mockResolvedValueOnce(0);
      mockedRepo.aggregateResumeAtsScores.mockResolvedValueOnce({
        _avg: { atsScore: null },
        _count: 0,
      } as any);
      mockedRepo.countInterviewSessionsByStatus.mockResolvedValueOnce([] as any);
      mockedRepo.aggregateInterviewScores.mockResolvedValueOnce({
        _avg: { overallScore: null },
        _count: 0,
      } as any);

      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.resumes.averageAtsScore).toBeNull();
      expect(res.body.interviews.averageScore).toBeNull();
    });
  });
});