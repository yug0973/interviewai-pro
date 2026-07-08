import request from 'supertest';
import { createApp } from '../../app';
import { resumeRepository } from './resume.repository';
import { extractResumeTextFast } from './resume.extraction';
import { uploadResumeFile, deleteResumeFile } from '../../integrations/storage/cloudinary-storage';
import { enqueueResumeAnalysis } from '../../jobs/resume-analysis.queue';
import { authRepository } from '../auth/auth.repository';
import { signAccessToken } from '../../common/utils/jwt';

// Mock everything that would otherwise touch Postgres, Cloudinary, Redis/BullMQ,
// or the filesystem - this is a true unit/integration test of the HTTP layer
// and service logic, not an end-to-end infra test.
jest.mock('./resume.repository');
jest.mock('./resume.extraction');
jest.mock('../../integrations/storage/cloudinary-storage');
jest.mock('../../jobs/resume-analysis.queue');
jest.mock('../auth/auth.repository');
jest.mock('../../config/prisma', () => ({ prisma: {} }));
jest.mock('../../config/redis', () => ({
  redis: {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  },
}));

const mockedRepo = resumeRepository as jest.Mocked<typeof resumeRepository>;
const mockedExtract = extractResumeTextFast as jest.MockedFunction<typeof extractResumeTextFast>;
const mockedUpload = uploadResumeFile as jest.MockedFunction<typeof uploadResumeFile>;
const mockedDelete = deleteResumeFile as jest.MockedFunction<typeof deleteResumeFile>;
const mockedEnqueue = enqueueResumeAnalysis as jest.MockedFunction<typeof enqueueResumeAnalysis>;
const mockedAuthRepo = authRepository as jest.Mocked<typeof authRepository>;

const app = createApp();

const USER_ID = 'user-1';
const accessToken = signAccessToken({ sub: USER_ID, role: 'CANDIDATE' as any });
const authHeader = `Bearer ${accessToken}`;

// The free-tier upload gate (resume.service.ts) calls authRepository.findUserById
// and resumeRepository.countResumesThisMonth before anything else - default both
// to "plenty of room left on the free plan" so existing tests don't need to know
// about billing. Tests that specifically exercise the gate override these.
beforeEach(() => {
  mockedAuthRepo.findUserById.mockResolvedValue({
    id: USER_ID,
    plan: 'FREE',
    proExpiresAt: null,
  } as any);
  mockedRepo.countResumesThisMonth.mockResolvedValue(0);
});

const MOCK_RESUME = {
  id: 'resume-1',
  userId: USER_ID,
  label: 'My Resume',
  isPrimary: false,
  targetRole: null,
  status: 'PROCESSING' as const,
  failureReason: null,
  originalFilename: 'resume.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 1234,
  cloudinaryPublicId: 'resumes/user-1/abc',
  cloudinaryUrl: 'https://res.cloudinary.com/demo/raw/upload/resumes/user-1/abc',
  extractionMethod: 'text',
  extractedText: 'Some extracted resume text that is long enough.',
  analysis: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// A minimal valid-looking PDF buffer (starts with the %PDF magic bytes) -
// good enough since extraction itself is mocked in these tests.
const FAKE_PDF_BUFFER = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(50, 'x')]);

describe('Resume module', () => {
  describe('POST /api/resumes', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/resumes')
        .attach('resume', FAKE_PDF_BUFFER, 'resume.pdf');

      expect(res.status).toBe(401);
    });

    it('rejects a request with no file attached', async () => {
      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', authHeader)
        .field('label', 'My Resume');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FILE');
    });

    it('uploads a resume, returns 202, and enqueues the analysis job', async () => {
      mockedExtract.mockResolvedValueOnce({ text: MOCK_RESUME.extractedText, method: 'text' });
      mockedUpload.mockResolvedValueOnce({
        publicId: MOCK_RESUME.cloudinaryPublicId,
        url: MOCK_RESUME.cloudinaryUrl,
      });
      mockedRepo.createResume.mockResolvedValueOnce(MOCK_RESUME as any);
      mockedEnqueue.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', authHeader)
        .field('label', 'My Resume')
        .field('targetRole', 'Backend Engineer')
        .attach('resume', FAKE_PDF_BUFFER, 'resume.pdf');

      expect(res.status).toBe(202);
      expect(res.body.resume.status).toBe('PROCESSING');
      expect(mockedEnqueue).toHaveBeenCalledWith(MOCK_RESUME.id);
      expect(mockedRepo.createResume).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, label: 'My Resume', targetRole: 'Backend Engineer' })
      );
    });

    it('returns 400 when the uploaded file fails validation (bad magic bytes)', async () => {
      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', authHeader)
        .attach('resume', Buffer.from('not a real pdf'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CORRUPT_OR_SPOOFED_FILE');
    });

    it('blocks a FREE user who has hit the monthly upload limit', async () => {
      mockedRepo.countResumesThisMonth.mockResolvedValueOnce(3); // matches FREE_RESUME_UPLOADS_PER_MONTH default

      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', authHeader)
        .attach('resume', FAKE_PDF_BUFFER, 'resume.pdf');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FREE_TIER_LIMIT_REACHED');
      expect(mockedRepo.createResume).not.toHaveBeenCalled();
    });

    it('lets an active PRO user upload past what would be the free limit', async () => {
      mockedAuthRepo.findUserById.mockResolvedValueOnce({
        id: USER_ID,
        plan: 'PRO',
        proExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10), // 10 days from now
      } as any);
      mockedRepo.countResumesThisMonth.mockResolvedValueOnce(99); // would fail the free gate
      mockedExtract.mockResolvedValueOnce({ text: MOCK_RESUME.extractedText, method: 'text' });
      mockedUpload.mockResolvedValueOnce({
        publicId: MOCK_RESUME.cloudinaryPublicId,
        url: MOCK_RESUME.cloudinaryUrl,
      });
      mockedRepo.createResume.mockResolvedValueOnce(MOCK_RESUME as any);
      mockedEnqueue.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', authHeader)
        .attach('resume', FAKE_PDF_BUFFER, 'resume.pdf');

      expect(res.status).toBe(202);
    });
  });

  describe('GET /api/resumes', () => {
    it('lists the caller\'s own resumes', async () => {
      mockedRepo.findAllForUser.mockResolvedValueOnce([MOCK_RESUME as any]);

      const res = await request(app).get('/api/resumes').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.resumes).toHaveLength(1);
      expect(mockedRepo.findAllForUser).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('GET /api/resumes/:id', () => {
    it('returns 404 for a resume the user does not own', async () => {
      mockedRepo.findByIdForUser.mockResolvedValueOnce(null);

      const res = await request(app)
        .get(`/api/resumes/${'00000000-0000-0000-0000-000000000000'}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
    });

    it('returns the resume when found', async () => {
      const id = '55555555-5555-5555-5555-555555555555';
      mockedRepo.findByIdForUser.mockResolvedValueOnce({ ...MOCK_RESUME, id } as any);

      const res = await request(app).get(`/api/resumes/${id}`).set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.resume.id).toBe(id);
    });
  });

  describe('PATCH /api/resumes/:id/primary', () => {
    it('promotes a resume to primary', async () => {
      const id = '11111111-1111-1111-1111-111111111111';
      mockedRepo.findByIdForUser.mockResolvedValueOnce({ ...MOCK_RESUME, id } as any);
      mockedRepo.setPrimary.mockResolvedValueOnce({ ...MOCK_RESUME, id, isPrimary: true } as any);

      const res = await request(app)
        .patch(`/api/resumes/${id}/primary`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.resume.isPrimary).toBe(true);
    });
  });

  describe('DELETE /api/resumes/:id', () => {
    it('deletes the resume and its stored file', async () => {
      const id = '22222222-2222-2222-2222-222222222222';
      mockedRepo.findByIdForUser.mockResolvedValueOnce({ ...MOCK_RESUME, id } as any);
      mockedRepo.delete.mockResolvedValueOnce({ ...MOCK_RESUME, id } as any);
      mockedDelete.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete(`/api/resumes/${id}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(204);
      expect(mockedRepo.delete).toHaveBeenCalledWith(id);
      expect(mockedDelete).toHaveBeenCalledWith(MOCK_RESUME.cloudinaryPublicId);
    });
  });

  describe('GET /api/resumes/compare', () => {
    it('rejects comparison when either resume has no analysis yet', async () => {
      const idA = '33333333-3333-3333-3333-333333333333';
      const idB = '44444444-4444-4444-4444-444444444444';
      mockedRepo.findByIdForUser.mockResolvedValueOnce({ ...MOCK_RESUME, id: idA, analysis: null } as any);
      mockedRepo.findByIdForUser.mockResolvedValueOnce({ ...MOCK_RESUME, id: idB, analysis: null } as any);

      const res = await request(app)
        .get(`/api/resumes/compare?a=${idA}&b=${idB}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ANALYSIS_NOT_READY');
    });
  });
});