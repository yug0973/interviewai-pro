import request from 'supertest';
import { createApp } from '../../app';
import { adminRepository } from './admin.repository';
import { signAccessToken } from '../../common/utils/jwt';

jest.mock('./admin.repository');
jest.mock('../../config/prisma', () => ({ prisma: {} }));
jest.mock('../../config/redis', () => ({
  redis: {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
  },
}));

const mockedRepo = adminRepository as jest.Mocked<typeof adminRepository>;

const app = createApp();

const ADMIN_ID = 'admin-1';
const adminToken = signAccessToken({ sub: ADMIN_ID, role: 'ADMIN' as any });
const adminHeader = `Bearer ${adminToken}`;

const CANDIDATE_ID = 'user-1';
const candidateToken = signAccessToken({ sub: CANDIDATE_ID, role: 'CANDIDATE' as any });
const candidateHeader = `Bearer ${candidateToken}`;

const MOCK_USER_SUMMARY = {
  id: CANDIDATE_ID,
  name: 'Test User',
  email: 'test@example.com',
  role: 'CANDIDATE' as const,
  plan: 'FREE' as const,
  proExpiresAt: null,
  isSuspended: false,
  createdAt: new Date(),
};

describe('Admin module', () => {
  describe('access control', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin (CANDIDATE) requests with 403', async () => {
      const res = await request(app).get('/api/admin/users').set('Authorization', candidateHeader);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/users', () => {
    it('lists users with pagination', async () => {
      mockedRepo.listUsers.mockResolvedValueOnce({ users: [MOCK_USER_SUMMARY as any], total: 1 });

      const res = await request(app).get('/api/admin/users').set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(20);
    });

    it('passes search/plan/role filters through to the repository', async () => {
      mockedRepo.listUsers.mockResolvedValueOnce({ users: [], total: 0 });

      const res = await request(app)
        .get('/api/admin/users?search=jane&plan=PRO&role=CANDIDATE&page=2&pageSize=10')
        .set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(mockedRepo.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'jane', plan: 'PRO', role: 'CANDIDATE', page: 2, pageSize: 10 })
      );
    });
  });

  describe('GET /api/admin/users/:id', () => {
    it('404s for a nonexistent user', async () => {
      mockedRepo.findUserDetail.mockResolvedValueOnce(null);

      const res = await request(app)
        .get(`/api/admin/users/${'00000000-0000-0000-0000-000000000000'}`)
        .set('Authorization', adminHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('returns user detail with usage counts', async () => {
      mockedRepo.findUserDetail.mockResolvedValueOnce({
        ...MOCK_USER_SUMMARY,
        resumeCount: 2,
        interviewCount: 1,
        paidOrderCount: 1,
      } as any);

      const res = await request(app)
        .get(`/api/admin/users/${'00000000-0000-0000-0000-000000000000'}`)
        .set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.user.resumeCount).toBe(2);
    });
  });

  describe('PATCH /api/admin/users/:id/suspend and /unsuspend', () => {
    const id = '11111111-1111-1111-1111-111111111111';

    it('suspends a user', async () => {
      mockedRepo.setSuspended.mockResolvedValueOnce({ ...MOCK_USER_SUMMARY, id, isSuspended: true } as any);

      const res = await request(app)
        .patch(`/api/admin/users/${id}/suspend`)
        .set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.user.isSuspended).toBe(true);
      expect(mockedRepo.setSuspended).toHaveBeenCalledWith(id, true);
    });

    it('unsuspends a user', async () => {
      mockedRepo.setSuspended.mockResolvedValueOnce({ ...MOCK_USER_SUMMARY, id, isSuspended: false } as any);

      const res = await request(app)
        .patch(`/api/admin/users/${id}/unsuspend`)
        .set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.user.isSuspended).toBe(false);
      expect(mockedRepo.setSuspended).toHaveBeenCalledWith(id, false);
    });
  });

  describe('PATCH /api/admin/users/:id/role', () => {
    it('changes a user role', async () => {
      const id = '22222222-2222-2222-2222-222222222222';
      mockedRepo.setRole.mockResolvedValueOnce({ ...MOCK_USER_SUMMARY, id, role: 'ADMIN' } as any);

      const res = await request(app)
        .patch(`/api/admin/users/${id}/role`)
        .set('Authorization', adminHeader)
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('ADMIN');
      expect(mockedRepo.setRole).toHaveBeenCalledWith(id, 'ADMIN');
    });

    it('rejects an invalid role value', async () => {
      const id = '22222222-2222-2222-2222-222222222222';
      const res = await request(app)
        .patch(`/api/admin/users/${id}/role`)
        .set('Authorization', adminHeader)
        .send({ role: 'SUPERUSER' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/admin/ai-usage', () => {
    it('shapes AI usage into a dashboard summary', async () => {
      mockedRepo.getAiUsageSummary.mockResolvedValueOnce({
        totals: { _sum: { costUsd: 1.5, totalTokens: 1000 }, _count: 10 },
        byProvider: [{ provider: 'mock', _sum: { costUsd: 1.5, totalTokens: 1000 }, _count: 10 }],
        byOperation: [{ operation: 'analyzeResume', _sum: { costUsd: 1.0 }, _count: 5 }],
        dailyRows: [
          { createdAt: new Date('2026-07-01T10:00:00Z'), costUsd: 0.5, success: true },
          { createdAt: new Date('2026-07-01T14:00:00Z'), costUsd: 0.3, success: true },
          { createdAt: new Date('2026-07-02T10:00:00Z'), costUsd: 0.7, success: false },
        ],
        failedCount: 1,
      } as any);

      const res = await request(app).get('/api/admin/ai-usage').set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.totalCostUsd).toBe(1.5);
      expect(res.body.totalRequests).toBe(10);
      expect(res.body.errorRate).toBe(10); // 1/10 = 10%
      expect(res.body.dailyCost).toEqual([
        { date: '2026-07-01', costUsd: 0.8 },
        { date: '2026-07-02', costUsd: 0.7 },
      ]);
      expect(res.body.byProvider[0]).toMatchObject({ provider: 'mock', requestCount: 10 });
    });
  });

  describe('GET /api/admin/billing/overview', () => {
    it('returns revenue and active-pro-user stats', async () => {
      mockedRepo.getBillingOverview.mockResolvedValueOnce({
        totalRevenuePaise: 149700,
        paidOrderCount: 3,
        totalOrderCount: 5,
        activeProUserCount: 3,
      });

      const res = await request(app).get('/api/admin/billing/overview').set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.totalRevenueInr).toBe(1497);
      expect(res.body.activeProUserCount).toBe(3);
    });
  });

  describe('GET /api/admin/billing/orders', () => {
    it('lists orders with pagination', async () => {
      mockedRepo.listOrders.mockResolvedValueOnce({ orders: [], total: 0 });

      const res = await request(app)
        .get('/api/admin/billing/orders?status=PAID')
        .set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(mockedRepo.listOrders).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PAID' })
      );
    });
  });

  describe('POST /api/admin/flags', () => {
    it('creates a content flag', async () => {
      mockedRepo.createFlag.mockResolvedValueOnce({
        id: 'flag-1',
        type: 'RESUME',
        targetId: '33333333-3333-3333-3333-333333333333',
        reason: 'Inappropriate content',
        status: 'OPEN',
      } as any);

      const res = await request(app)
        .post('/api/admin/flags')
        .set('Authorization', adminHeader)
        .send({
          type: 'RESUME',
          targetId: '33333333-3333-3333-3333-333333333333',
          reason: 'Inappropriate content',
        });

      expect(res.status).toBe(201);
      expect(res.body.flag.status).toBe('OPEN');
      expect(mockedRepo.createFlag).toHaveBeenCalledWith(
        expect.objectContaining({ flaggedByUserId: ADMIN_ID })
      );
    });
  });

  describe('GET /api/admin/flags', () => {
    it('lists flags with pagination', async () => {
      mockedRepo.listFlags.mockResolvedValueOnce({ flags: [], total: 0 });

      const res = await request(app)
        .get('/api/admin/flags?status=OPEN')
        .set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(mockedRepo.listFlags).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN' }));
    });
  });

  describe('PATCH /api/admin/flags/:id/resolve', () => {
    const flagId = '44444444-4444-4444-4444-444444444444';

    it('404s for a nonexistent flag', async () => {
      mockedRepo.findFlagById.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch(`/api/admin/flags/${flagId}/resolve`)
        .set('Authorization', adminHeader)
        .send({ resolutionNote: 'Reviewed, no action needed' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FLAG_NOT_FOUND');
    });

    it('rejects resolving an already-resolved flag', async () => {
      mockedRepo.findFlagById.mockResolvedValueOnce({ id: flagId, status: 'RESOLVED' } as any);

      const res = await request(app)
        .patch(`/api/admin/flags/${flagId}/resolve`)
        .set('Authorization', adminHeader)
        .send({ resolutionNote: 'Reviewed, no action needed' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FLAG_ALREADY_RESOLVED');
    });

    it('resolves an open flag', async () => {
      mockedRepo.findFlagById.mockResolvedValueOnce({ id: flagId, status: 'OPEN' } as any);
      mockedRepo.resolveFlag.mockResolvedValueOnce({ id: flagId, status: 'RESOLVED' } as any);

      const res = await request(app)
        .patch(`/api/admin/flags/${flagId}/resolve`)
        .set('Authorization', adminHeader)
        .send({ resolutionNote: 'Reviewed, no action needed' });

      expect(res.status).toBe(200);
      expect(res.body.flag.status).toBe('RESOLVED');
      expect(mockedRepo.resolveFlag).toHaveBeenCalledWith(flagId, ADMIN_ID, 'Reviewed, no action needed');
    });
  });
});