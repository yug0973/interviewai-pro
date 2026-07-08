import request from 'supertest';
import { createApp } from '../../app';
import { resumeRepository } from '../resume/resume.repository';
import { signAccessToken } from '../../common/utils/jwt';

jest.mock('../resume/resume.repository');
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

const mockedResumeRepo = resumeRepository as jest.Mocked<typeof resumeRepository>;

const app = createApp();

const USER_ID = 'user-1';
const accessToken = signAccessToken({ sub: USER_ID, role: 'CANDIDATE' as any });
const authHeader = `Bearer ${accessToken}`;

describe('Job Match module', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post('/api/job-match').send({
      jobDescriptionText: 'We need a backend engineer with Node.js and PostgreSQL experience.',
      resumeText: 'I am a backend engineer with Node.js and PostgreSQL experience.',
    });
    expect(res.status).toBe(401);
  });

  it('rejects request with missing resumeId and resumeText', async () => {
    const res = await request(app)
      .post('/api/job-match')
      .set('Authorization', authHeader)
      .send({
        jobDescriptionText: 'We need a backend engineer with Node.js and PostgreSQL experience.',
      });
    expect(res.status).toBe(400);
  });

  it('matches raw resume text against a job description', async () => {
    const res = await request(app)
      .post('/api/job-match')
      .set('Authorization', authHeader)
      .send({
        jobDescriptionText: 'We are seeking a Senior Backend Engineer proficient in Node.js, PostgreSQL, Redis, and high-scale systems.',
        resumeText: 'Experienced Backend Developer with 5 years building microservices in Node.js, TypeScript, PostgreSQL, and Redis.',
        targetRole: 'Senior Backend Engineer',
      });

    expect(res.status).toBe(200);
    expect(res.body.match).toBeDefined();
    expect(res.body.match.matchScore).toBeGreaterThanOrEqual(0);
    expect(res.body.match.matchingSkills.length).toBeGreaterThan(0);
    expect(res.body.match.resumeImprovements.length).toBeGreaterThan(0);
    expect(res.body.match.likelyInterviewQuestions.length).toBeGreaterThan(0);
  });

  it('matches an uploaded resume by resumeId', async () => {
    const resumeId = '11111111-1111-1111-1111-111111111111';
    mockedResumeRepo.findByIdForUser.mockResolvedValueOnce({
      id: resumeId,
      extractedText: 'Senior Backend Engineer with Node.js, Redis, and PostgreSQL experience.',
      analysis: { detectedRole: 'Backend Engineer' },
    } as any);

    const res = await request(app)
      .post('/api/job-match')
      .set('Authorization', authHeader)
      .send({
        resumeId,
        jobDescriptionText: 'Looking for a Backend Engineer with strong Node.js, Redis, and PostgreSQL background.',
      });

    expect(res.status).toBe(200);
    expect(res.body.match).toBeDefined();
    expect(res.body.match.matchScore).toBeGreaterThan(0);
  });

  it('returns 404 when the resumeId is not found', async () => {
    mockedResumeRepo.findByIdForUser.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/job-match')
      .set('Authorization', authHeader)
      .send({
        resumeId: '22222222-2222-2222-2222-222222222222',
        jobDescriptionText: 'Looking for a Backend Engineer with strong Node.js background.',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
  });
});
