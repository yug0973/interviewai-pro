import crypto from 'node:crypto';
import RazorpaySDK from 'razorpay';
import { getRazorpayClient } from '../../config/razorpay';
import { env } from '../../config/env';
import { billingRepository } from './billing.repository';
import { isProActive } from './plan.util';
import { AppError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';
import type { VerifyPaymentInput } from './billing.schema';

export const billingService = {
  /**
   * Creates a Razorpay order for the single Pro plan and persists a CREATED
   * row locally. The frontend uses the returned razorpayOrderId + keyId to
   * open Razorpay Checkout directly - no separate "get checkout config"
   * endpoint needed.
   */
  async createProOrder(userId: string) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw AppError.badRequest(
        'Payments are not configured on this server yet (missing Razorpay keys)',
        'PAYMENTS_NOT_CONFIGURED'
      );
    }

    const amountPaise = env.RAZORPAY_PRO_PLAN_AMOUNT_PAISE;
    const planDurationDays = env.RAZORPAY_PRO_PLAN_DURATION_DAYS;

    let razorpayOrder;
    try {
      razorpayOrder = await getRazorpayClient().orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `pro-${Date.now()}`,
        notes: { userId, planDurationDays: String(planDurationDays) },
      });
    } catch (err) {
      // Razorpay's SDK often rejects with a plain object like
      // { statusCode, error: { code, description } } rather than a real
      // Error, so err.message is usually empty/useless - dig out the real
      // reason (e.g. "Authentication failed", "The api key provided is
      // invalid") and surface that instead of a mystery 500.
      const razorpayDescription =
        (err as { error?: { description?: string } })?.error?.description ??
        (err instanceof Error ? err.message : undefined);
      logger.error('Razorpay order creation failed', { userId, err });
      throw AppError.badRequest(
        razorpayDescription
          ? `Payment provider rejected the request: ${razorpayDescription}`
          : 'Could not create a payment order right now. Try again shortly.',
        'RAZORPAY_ORDER_FAILED'
      );
    }

    const order = await billingRepository.createOrder({
      userId,
      razorpayOrderId: razorpayOrder.id,
      amountPaise,
      currency: 'INR',
      planDurationDays,
    });

    logger.info('Pro order created', { orderId: order.id, userId, amountPaise });

    return {
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amountPaise,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID,
    };
  },

  /**
   * Verifies the signature Razorpay Checkout hands back to the frontend on
   * success, then upgrades the user immediately - this is what gives the
   * user instant feedback without waiting on the webhook to arrive. Uses the
   * exact HMAC-SHA256(order_id + "|" + payment_id) scheme Razorpay documents
   * for backend payment verification.
   */
  async verifyPayment(userId: string, input: VerifyPaymentInput) {
    if (!env.RAZORPAY_KEY_SECRET) {
      throw AppError.badRequest('Payments are not configured on this server yet', 'PAYMENTS_NOT_CONFIGURED');
    }

    const order = await billingRepository.findOrderByRazorpayId(input.razorpay_order_id);
    if (!order || order.userId !== userId) {
      throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    if (order.status === 'PAID') {
      // Idempotent: the webhook may have already processed this order.
      return billingRepository.findUserPlan(userId);
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== input.razorpay_signature) {
      await billingRepository.markOrderFailed(order.id);
      throw AppError.badRequest('Invalid payment signature', 'INVALID_PAYMENT_SIGNATURE');
    }

    await billingRepository.markOrderPaid(order.id, input.razorpay_payment_id);
    await billingRepository.upgradeToPro(userId, order.planDurationDays);

    logger.info('Payment verified, user upgraded to Pro', { orderId: order.id, userId });

    return billingRepository.findUserPlan(userId);
  },

  /**
   * Authoritative fallback path: processes Razorpay's server-to-server
   * webhook, in case the user closed their browser before the client-side
   * verify call fired. Idempotent against verifyPayment() via the same
   * order.status === 'PAID' check, so it's safe if both paths fire.
   */
  async handleWebhook(rawBody: string, signature: string) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      throw AppError.badRequest('Webhook is not configured on this server yet', 'WEBHOOK_NOT_CONFIGURED');
    }

    const isValid = RazorpaySDK.validateWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
    if (!isValid) {
      throw AppError.badRequest('Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
    }

    const event = JSON.parse(rawBody);

    if (event.event !== 'payment.captured' && event.event !== 'order.paid') {
      // Not a payment-success event we care about; acknowledge and ignore.
      return { processed: false };
    }

    const payment = event.payload?.payment?.entity;
    const razorpayOrderId: string | undefined = payment?.order_id;
    const razorpayPaymentId: string | undefined = payment?.id;

    if (!razorpayOrderId || !razorpayPaymentId) {
      logger.error('Webhook payload missing order_id/payment_id', { event: event.event });
      return { processed: false };
    }

    const order = await billingRepository.findOrderByRazorpayId(razorpayOrderId);
    if (!order) {
      logger.error('Webhook referenced an order that does not exist locally', { razorpayOrderId });
      return { processed: false };
    }

    if (order.status === 'PAID') {
      return { processed: true, alreadyProcessed: true };
    }

    await billingRepository.markOrderPaid(order.id, razorpayPaymentId);
    await billingRepository.upgradeToPro(order.userId, order.planDurationDays);

    logger.info('Webhook processed, user upgraded to Pro', { orderId: order.id, userId: order.userId });

    return { processed: true, alreadyProcessed: false };
  },

  async getPlanStatus(userId: string) {
    const user = await billingRepository.findUserPlan(userId);
    if (!user) {
      throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    }
    return {
      plan: user.plan,
      proExpiresAt: user.proExpiresAt,
      isPro: isProActive(user),
    };
  },
};