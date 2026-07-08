import request from 'supertest';
import RazorpaySDK from 'razorpay';
import { createApp } from '../../app';
import { billingRepository } from './billing.repository';
import { getRazorpayClient } from '../../config/razorpay';
import { signAccessToken } from '../../common/utils/jwt';

jest.mock('./billing.repository');
jest.mock('../../config/razorpay');
jest.mock('razorpay');
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
      RAZORPAY_KEY_ID: 'test_key_id',
      RAZORPAY_KEY_SECRET: 'test_key_secret',
      RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
    },
  };
});

const mockedRepo = billingRepository as jest.Mocked<typeof billingRepository>;
const mockedGetClient = getRazorpayClient as jest.MockedFunction<typeof getRazorpayClient>;
const mockedValidateWebhook = RazorpaySDK.validateWebhookSignature as jest.MockedFunction<typeof RazorpaySDK.validateWebhookSignature>;

const app = createApp();

const USER_ID = 'user-1';
const accessToken = signAccessToken({ sub: USER_ID, role: 'CANDIDATE' as any });
const authHeader = `Bearer ${accessToken}`;

const MOCK_ORDER = {
  id: 'order-row-1',
  userId: USER_ID,
  razorpayOrderId: 'order_RZP123',
  razorpayPaymentId: null,
  amountPaise: 49900,
  currency: 'INR',
  status: 'CREATED' as const,
  planDurationDays: 30,
  createdAt: new Date(),
  paidAt: null,
};

describe('Billing module', () => {
  describe('POST /api/billing/orders', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).post('/api/billing/orders');
      expect(res.status).toBe(401);
    });

    it('creates a Razorpay order and a local CREATED row', async () => {
      const mockCreate = jest.fn().mockResolvedValueOnce({ id: 'order_RZP123' });
      mockedGetClient.mockReturnValueOnce({ orders: { create: mockCreate } } as any);
      mockedRepo.createOrder.mockResolvedValueOnce(MOCK_ORDER as any);

      const res = await request(app).post('/api/billing/orders').set('Authorization', authHeader);

      expect(res.status).toBe(201);
      expect(res.body.razorpayOrderId).toBe('order_RZP123');
      expect(res.body.amountPaise).toBe(49900);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 49900, currency: 'INR' })
      );
      expect(mockedRepo.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, razorpayOrderId: 'order_RZP123' })
      );
    });
  });

  describe('POST /api/billing/orders/verify', () => {
    const validBody = {
      razorpay_order_id: 'order_RZP123',
      razorpay_payment_id: 'pay_RZP456',
      razorpay_signature: 'deadbeef',
    };

    it('rejects a payload missing required fields', async () => {
      const res = await request(app)
        .post('/api/billing/orders/verify')
        .set('Authorization', authHeader)
        .send({ razorpay_order_id: 'order_RZP123' });

      expect(res.status).toBe(400);
    });

    it('404s when the order does not belong to the caller', async () => {
      mockedRepo.findOrderByRazorpayId.mockResolvedValueOnce({ ...MOCK_ORDER, userId: 'someone-else' } as any);

      const res = await request(app)
        .post('/api/billing/orders/verify')
        .set('Authorization', authHeader)
        .send(validBody);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('rejects an invalid signature and marks the order FAILED', async () => {
      mockedRepo.findOrderByRazorpayId.mockResolvedValueOnce(MOCK_ORDER as any);

      const res = await request(app)
        .post('/api/billing/orders/verify')
        .set('Authorization', authHeader)
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAYMENT_SIGNATURE');
      expect(mockedRepo.markOrderFailed).toHaveBeenCalledWith(MOCK_ORDER.id);
    });

    it('is idempotent when the order was already marked PAID (e.g. by the webhook)', async () => {
      mockedRepo.findOrderByRazorpayId.mockResolvedValueOnce({ ...MOCK_ORDER, status: 'PAID' } as any);
      mockedRepo.findUserPlan.mockResolvedValueOnce({ plan: 'PRO', proExpiresAt: new Date() } as any);

      const res = await request(app)
        .post('/api/billing/orders/verify')
        .set('Authorization', authHeader)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.plan).toBe('PRO');
    });
  });

  describe('GET /api/billing/status', () => {
    it('reports isPro:false for a lapsed Pro user', async () => {
      mockedRepo.findUserPlan.mockResolvedValueOnce({
        plan: 'PRO',
        proExpiresAt: new Date(Date.now() - 1000),
      } as any);

      const res = await request(app).get('/api/billing/status').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.isPro).toBe(false);
    });

    it('reports isPro:true for an active Pro user', async () => {
      mockedRepo.findUserPlan.mockResolvedValueOnce({
        plan: 'PRO',
        proExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      } as any);

      const res = await request(app).get('/api/billing/status').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.isPro).toBe(true);
    });
  });

  describe('POST /api/billing/webhook', () => {
    it('rejects an invalid webhook signature', async () => {
      mockedValidateWebhook.mockReturnValueOnce(false);

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'bad-signature')
        .send(JSON.stringify({ event: 'payment.captured' }));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
    });

    it('processes a valid payment.captured event and upgrades the user', async () => {
      mockedValidateWebhook.mockReturnValueOnce(true);
      mockedRepo.findOrderByRazorpayId.mockResolvedValueOnce(MOCK_ORDER as any);
      mockedRepo.markOrderPaid.mockResolvedValueOnce({ ...MOCK_ORDER, status: 'PAID' } as any);
      mockedRepo.upgradeToPro.mockResolvedValueOnce({} as any);

      const payload = {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_RZP456', order_id: 'order_RZP123' } } },
      };

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'good-signature')
        .send(JSON.stringify(payload));

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(true);
      expect(mockedRepo.markOrderPaid).toHaveBeenCalledWith(MOCK_ORDER.id, 'pay_RZP456');
      expect(mockedRepo.upgradeToPro).toHaveBeenCalledWith(MOCK_ORDER.userId, MOCK_ORDER.planDurationDays);
    });

    it('is idempotent when the webhook fires for an already-PAID order', async () => {
      mockedValidateWebhook.mockReturnValueOnce(true);
      mockedRepo.findOrderByRazorpayId.mockResolvedValueOnce({ ...MOCK_ORDER, status: 'PAID' } as any);

      const payload = {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_RZP456', order_id: 'order_RZP123' } } },
      };

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'good-signature')
        .send(JSON.stringify(payload));

      expect(res.status).toBe(200);
      expect(res.body.alreadyProcessed).toBe(true);
      expect(mockedRepo.markOrderPaid).not.toHaveBeenCalled();
    });

    it('ignores irrelevant event types without erroring', async () => {
      mockedValidateWebhook.mockReturnValueOnce(true);

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'good-signature')
        .send(JSON.stringify({ event: 'refund.processed' }));

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(false);
    });
  });
});