import request from 'supertest';
import { createApp } from '../../app';
import { interviewRepository } from './interview.repository';
import { resumeRepository } from '../resume/resume.repository';
import { authRepository } from '../auth/auth.repository';
import { signAccessToken } from '../../common/utils/jwt';

jest.mock('./interview.repository');
jest.mock('../resume/resume.repository');
jest.mock('../auth/auth.repository');
jest.mock('../../config/prisma', () => ({ prisma: {} }));
jest.mock('../../config/redis', () => ({
  redis: {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  },
}));
jest.mock('../../config/env', () => {
  const actual = jest.requireActual('../../config/env');
  return {
    ...actual,
    env: {
      ...actual.env,
      AI_PROVIDER: 'mock',
    },
  };
});

const mockedRepo = interviewRepository as jest.Mocked<typeof interviewRepository>;
const mockedResumeRepo = resumeRepository as jest.Mocked<typeof resumeRepository>;
const mockedAuthRepo = authRepository as jest.Mocked<typeof authRepository>;

const app = createApp();

const USER_ID = 'user-1';
const accessToken = signAccessToken({ sub: USER_ID, role: 'CANDIDATE' as any });
const authHeader = `Bearer ${accessToken}`;

beforeEach(() => {
  mockedAuthRepo.findUserById.mockResolvedValue({
    id: USER_ID,
    plan: 'FREE',
    proExpiresAt: null,
  } as any);
  mockedRepo.countSessionsThisMonth.mockResolvedValue(0);
});

const MOCK_SESSION = {
  id: '99999999-9999-9999-9999-999999999999',
  userId: USER_ID,
  resumeId: null,
  targetRole: 'Backend Engineer',
  difficulty: 'medium',
  mode: 'TEXT',
  status: 'IN_PROGRESS' as const,
  totalQuestions: 5,
  overallScore: null,
  strengths: [],
  weaknesses: [],
  recommendation: null,
  createdAt: new Date(),
  completedAt: null,
  questions: [],
};

const MOCK_QUESTION = {
  id: 'q1',
  sessionId: MOCK_SESSION.id,
  order: 1,
  questionText: 'How would you design a fault-tolerant caching tier for a high-traffic Backend Engineer service?',
  category: 'System Architecture',
  difficulty: 'medium',
  isFollowUp: false,
  answerText: null,
  answeredAt: null,
  score: null,
  evaluationStrengths: [],
  evaluationImprovements: [],
  idealAnswerSummary: null,
  createdAt: new Date(),
};

describe('Interview module', () => {
  describe('POST /api/interviews', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).post('/api/interviews').send({ targetRole: 'Backend Engineer' });
      expect(res.status).toBe(401);
    });

    it('rejects when neither targetRole nor resumeId is given', async () => {
      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', authHeader)
        .send({});

      expect(res.status).toBe(400);
    });

    it('starts a session using an explicit targetRole and returns the opening question', async () => {
      mockedRepo.createSession.mockResolvedValueOnce(MOCK_SESSION as any);
      mockedRepo.createQuestion.mockResolvedValueOnce(MOCK_QUESTION as any);
      mockedRepo.findSessionByIdForUser.mockResolvedValueOnce({
        ...MOCK_SESSION,
        questions: [MOCK_QUESTION],
      } as any);

      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', authHeader)
        .send({ targetRole: 'Backend Engineer' });

      expect(res.status).toBe(201);
      expect(res.body.session.status).toBe('IN_PROGRESS');
      expect(res.body.currentQuestion.order).toBe(1);
      expect(mockedRepo.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, targetRole: 'Backend Engineer', difficulty: 'medium' })
      );
    });

    it('derives targetRole and difficulty from a linked resume when not given explicitly', async () => {
      const resumeId = '11111111-1111-1111-1111-111111111111';
      mockedResumeRepo.findByIdForUser.mockResolvedValueOnce({
        id: resumeId,
        targetRole: null,
        analysis: { detectedRole: 'Frontend Engineer', experienceLevel: 'senior', technicalSkills: ['React', 'TypeScript'] },
      } as any);
      mockedRepo.createSession.mockResolvedValueOnce({
        ...MOCK_SESSION,
        resumeId,
        targetRole: 'Frontend Engineer',
        difficulty: 'hard',
      } as any);
      mockedRepo.createQuestion.mockResolvedValueOnce(MOCK_QUESTION as any);
      mockedRepo.findSessionByIdForUser.mockResolvedValueOnce({
        ...MOCK_SESSION,
        resumeId,
        targetRole: 'Frontend Engineer',
        difficulty: 'hard',
        questions: [MOCK_QUESTION],
      } as any);

      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', authHeader)
        .send({ resumeId });

      expect(res.status).toBe(201);
      expect(mockedRepo.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ targetRole: 'Frontend Engineer', difficulty: 'hard' })
      );
    });

    it('404s when resumeId does not belong to the caller', async () => {
      const resumeId = '22222222-2222-2222-2222-222222222222';
      mockedResumeRepo.findByIdForUser.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', authHeader)
        .send({ resumeId });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });

    it('blocks a FREE user who has hit the monthly session limit', async () => {
      mockedRepo.countSessionsThisMonth.mockResolvedValueOnce(3);

      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', authHeader)
        .send({ targetRole: 'Backend Engineer' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FREE_TIER_LIMIT_REACHED');
      expect(mockedRepo.createSession).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/interviews/:id/answer', () => {
    it('generates an adaptive follow-up when more questions remain', async () => {
      mockedRepo.findSessionByIdForUser
        .mockResolvedValueOnce({
          ...MOCK_SESSION,
          questions: [MOCK_QUESTION],
        } as any)
        .mockResolvedValueOnce({
          ...MOCK_SESSION,
          questions: [
            { ...MOCK_QUESTION, answerText: 'my answer', score: 78 },
            { ...MOCK_QUESTION, id: 'q2', order: 2, isFollowUp: true },
          ],
        } as any);

      mockedRepo.findLatestUnansweredQuestion.mockResolvedValueOnce(MOCK_QUESTION as any);
      mockedRepo.answerQuestion.mockResolvedValueOnce({ ...MOCK_QUESTION, answerText: 'my answer' } as any);
      mockedRepo.saveEvaluation.mockResolvedValueOnce({ ...MOCK_QUESTION, score: 78 } as any);
      mockedRepo.createQuestion.mockResolvedValueOnce({
        ...MOCK_QUESTION,
        id: 'q2',
        order: 2,
        isFollowUp: true,
      } as any);

      const res = await request(app)
        .post(`/api/interviews/${MOCK_SESSION.id}/answer`)
        .set('Authorization', authHeader)
        .send({ answerText: 'A rate limiter can use a token bucket algorithm stored in Redis.' });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(false);
      expect(res.body.currentQuestion.order).toBe(2);
      expect(res.body.currentQuestion.isFollowUp).toBe(true);
      expect(res.body.evaluation).toBeDefined();
    });

    it('finalizes the session with a summary once totalQuestions is reached', async () => {
      const finalQuestion = { ...MOCK_QUESTION, id: 'q5', order: 5 };
      mockedRepo.findSessionByIdForUser
        .mockResolvedValueOnce({
          ...MOCK_SESSION,
          totalQuestions: 5,
          questions: [finalQuestion],
        } as any)
        .mockResolvedValueOnce({
          ...MOCK_SESSION,
          status: 'COMPLETED',
          overallScore: 78,
          questions: [{ ...finalQuestion, answerText: 'final answer', score: 80 }],
        } as any);

      mockedRepo.findLatestUnansweredQuestion.mockResolvedValueOnce(finalQuestion as any);
      mockedRepo.answerQuestion.mockResolvedValueOnce({ ...finalQuestion, answerText: 'final answer' } as any);
      mockedRepo.saveEvaluation.mockResolvedValueOnce({ ...finalQuestion, score: 80 } as any);
      mockedRepo.findAnsweredQuestions.mockResolvedValueOnce([
        { ...finalQuestion, answerText: 'final answer', score: 80 },
      ] as any);
      mockedRepo.completeSession.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: 'COMPLETED',
        overallScore: 78,
        completedAt: new Date(),
      } as any);

      const res = await request(app)
        .post(`/api/interviews/${MOCK_SESSION.id}/answer`)
        .set('Authorization', authHeader)
        .send({ answerText: 'This is my final comprehensive answer explaining system design.' });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
      expect(res.body.currentQuestion).toBeNull();
      expect(res.body.session.status).toBe('COMPLETED');
      expect(mockedRepo.completeSession).toHaveBeenCalled();
    });

    it('rejects answering a session that already ended', async () => {
      mockedRepo.findSessionByIdForUser.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: 'COMPLETED',
        questions: [],
      } as any);

      const res = await request(app)
        .post(`/api/interviews/${MOCK_SESSION.id}/answer`)
        .set('Authorization', authHeader)
        .send({ answerText: 'too late' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SESSION_NOT_IN_PROGRESS');
    });
  });

  describe('GET /api/interviews and /:id', () => {
    it("lists the caller's sessions", async () => {
      mockedRepo.findAllSessionsForUser.mockResolvedValueOnce([MOCK_SESSION as any]);

      const res = await request(app).get('/api/interviews').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
    });

    it('404s for a session the caller does not own', async () => {
      mockedRepo.findSessionByIdForUser.mockResolvedValueOnce(null);

      const res = await request(app)
        .get(`/api/interviews/${MOCK_SESSION.id}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/interviews/:id/abandon', () => {
    it('marks an in-progress session as ABANDONED', async () => {
      mockedRepo.findSessionByIdForUser.mockResolvedValueOnce({
        ...MOCK_SESSION,
        questions: [],
      } as any);
      mockedRepo.updateSessionStatus.mockResolvedValueOnce({
        ...MOCK_SESSION,
        status: 'ABANDONED',
      } as any);

      const res = await request(app)
        .post(`/api/interviews/${MOCK_SESSION.id}/abandon`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.session.status).toBe('ABANDONED');
    });
  });
});