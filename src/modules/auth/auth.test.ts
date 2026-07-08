import request from 'supertest';
import { createApp } from '../../app';
import { authRepository } from './auth.repository';
import { hashPassword } from '../../common/utils/hash';

// Mock the repository so tests don't require a live Postgres connection.
jest.mock('./auth.repository');
// The repository mock above means nothing actually touches Prisma, so also
// mock the client module itself - keeps this a true unit test that doesn't
// depend on `prisma generate` having been run.
jest.mock('../../config/prisma', () => ({ prisma: {} }));
jest.mock('../../config/redis', () => ({
  redis: {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  },
}));

const mockedRepo = authRepository as jest.Mocked<typeof authRepository>;

const app = createApp();

const MOCK_USER = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'CANDIDATE' as const,
  plan: 'FREE' as const,
  proExpiresAt: null,
  isSuspended: false,
  passwordHash: '',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Auth module', () => {
  beforeAll(async () => {
    MOCK_USER.passwordHash = await hashPassword('correct-password-1');
  });

  describe('POST /api/auth/signup', () => {
    it('creates a new user and returns an access token + refresh cookie', async () => {
      mockedRepo.findUserByEmail.mockResolvedValueOnce(null);
      mockedRepo.createUser.mockResolvedValueOnce(MOCK_USER);
      mockedRepo.createRefreshToken.mockResolvedValueOnce({} as any);

      const res = await request(app).post('/api/auth/signup').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'correct-password-1',
      });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.headers['set-cookie']?.[0]).toMatch(/iap_refresh=/);
    });

    it('rejects signup with an already-registered email', async () => {
      mockedRepo.findUserByEmail.mockResolvedValueOnce(MOCK_USER);

      const res = await request(app).post('/api/auth/signup').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'correct-password-1',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('rejects a weak/invalid payload with 400', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        name: 'A',
        email: 'not-an-email',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials', async () => {
      mockedRepo.findUserByEmail.mockResolvedValueOnce(MOCK_USER);
      mockedRepo.createRefreshToken.mockResolvedValueOnce({} as any);

      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'correct-password-1',
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('rejects incorrect password', async () => {
      mockedRepo.findUserByEmail.mockResolvedValueOnce(MOCK_USER);

      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrong-password',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects login for a nonexistent email', async () => {
      mockedRepo.findUserByEmail.mockResolvedValueOnce(null);

      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@example.com',
        password: 'whatever123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without an access token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns the current user with a valid access token', async () => {
      mockedRepo.findUserByEmail.mockResolvedValueOnce(null);
      mockedRepo.createUser.mockResolvedValueOnce(MOCK_USER);
      mockedRepo.createRefreshToken.mockResolvedValueOnce({} as any);

      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'correct-password-1',
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${signupRes.body.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(MOCK_USER.id);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rejects refresh with no cookie', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MISSING_REFRESH_TOKEN');
    });

    it('rotates tokens and revokes the old refresh token on reuse detection', async () => {
      mockedRepo.findUserByEmail.mockResolvedValueOnce(null);
      mockedRepo.createUser.mockResolvedValueOnce(MOCK_USER);

      const tokenStore = new Map<string, any>();

      mockedRepo.createRefreshToken.mockImplementation(async (data) => {
        const record = { ...data, revoked: false, createdAt: new Date() };
        tokenStore.set(data.id, record);
        return record;
      });
      mockedRepo.findRefreshTokenById.mockImplementation(async (id) => tokenStore.get(id) ?? null);
      mockedRepo.revokeRefreshTokenById.mockImplementation(async (id) => {
        const record = tokenStore.get(id);
        if (record) record.revoked = true;
        return record;
      });
      mockedRepo.findUserById.mockResolvedValue(MOCK_USER);

      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'correct-password-1',
      });

      const cookie = signupRes.headers['set-cookie'][0];

      // First refresh should succeed and rotate the token.
      const firstRefresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
      expect(firstRefresh.status).toBe(200);

      // Reusing the OLD cookie (now revoked, but still present in tokenStore) should be detected as reuse.
      mockedRepo.revokeAllRefreshTokensForUser.mockResolvedValueOnce({ count: 1 } as any);
      const reuseAttempt = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

      expect(reuseAttempt.status).toBe(401);
      expect(reuseAttempt.body.error.code).toBe('REFRESH_REUSE_DETECTED');
      expect(mockedRepo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith(MOCK_USER.id);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the refresh cookie and returns 204', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(204);
    });
  });
});
