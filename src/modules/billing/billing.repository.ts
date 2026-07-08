import { prisma } from '../../config/prisma';

export interface CreateOrderData {
  userId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  planDurationDays: number;
}

export const billingRepository = {
  createOrder(data: CreateOrderData) {
    return prisma.order.create({ data });
  },

  findOrderByRazorpayId(razorpayOrderId: string) {
    return prisma.order.findUnique({ where: { razorpayOrderId } });
  },

  markOrderPaid(id: string, razorpayPaymentId: string) {
    return prisma.order.update({
      where: { id },
      data: { status: 'PAID', razorpayPaymentId, paidAt: new Date() },
    });
  },

  markOrderFailed(id: string) {
    return prisma.order.update({ where: { id }, data: { status: 'FAILED' } });
  },

  findUserPlan(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, proExpiresAt: true },
    });
  },

  /**
   * Extends from the current expiry if the user is still an active Pro
   * (stacking durations on renewal before expiry), otherwise starts fresh
   * from now - so renewing early never loses time, and renewing after
   * lapsing doesn't backdate either.
   */
  async upgradeToPro(userId: string, durationDays: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { proExpiresAt: true } });
    const now = new Date();
    const base = user?.proExpiresAt && user.proExpiresAt.getTime() > now.getTime() ? user.proExpiresAt : now;
    const proExpiresAt = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);

    return prisma.user.update({
      where: { id: userId },
      data: { plan: 'PRO', proExpiresAt },
    });
  },
};