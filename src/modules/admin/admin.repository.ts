import { prisma } from '../../config/prisma';
import type { Role, Prisma } from '@prisma/client';

export interface ListUsersParams {
  search?: string;
  plan?: 'FREE' | 'PRO';
  role?: Role;
  page: number;
  pageSize: number;
}

export interface ListOrdersParams {
  status?: 'CREATED' | 'PAID' | 'FAILED';
  page: number;
  pageSize: number;
}

export interface ListFlagsParams {
  status?: 'OPEN' | 'RESOLVED';
  page: number;
  pageSize: number;
}

export interface CreateFlagData {
  type: 'RESUME' | 'INTERVIEW_SESSION';
  targetId: string;
  reason: string;
  flaggedByUserId: string;
}

const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  plan: true,
  proExpiresAt: true,
  isSuspended: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const adminRepository = {
  async listUsers(params: ListUsersParams) {
    const where: Prisma.UserWhereInput = {
      ...(params.plan ? { plan: params.plan } : {}),
      ...(params.role ? { role: params.role } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSummarySelect,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  },

  async findUserDetail(id: string) {
    const [user, resumeCount, interviewCount, orderCount] = await Promise.all([
      prisma.user.findUnique({ where: { id }, select: userSummarySelect }),
      prisma.resume.count({ where: { userId: id } }),
      prisma.interviewSession.count({ where: { userId: id } }),
      prisma.order.count({ where: { userId: id, status: 'PAID' } }),
    ]);

    if (!user) return null;
    return { ...user, resumeCount, interviewCount, paidOrderCount: orderCount };
  },

  setSuspended(id: string, isSuspended: boolean) {
    return prisma.user.update({ where: { id }, data: { isSuspended }, select: userSummarySelect });
  },

  setRole(id: string, role: Role) {
    return prisma.user.update({ where: { id }, data: { role }, select: userSummarySelect });
  },

  /**
   * Aggregates AIRequestLog into per-provider and per-operation cost/token/
   * error breakdowns, plus a daily cost series for the given window. All
   * read-only over data the AI instrumentation layer already logs - no new
   * AI-layer changes needed for this dashboard.
   */
  async getAiUsageSummary(sinceDays: number) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    const [totals, byProvider, byOperation, dailyRows] = await Promise.all([
      prisma.aIRequestLog.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { costUsd: true, totalTokens: true },
        _count: true,
      }),
      prisma.aIRequestLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since } },
        _sum: { costUsd: true, totalTokens: true },
        _count: true,
      }),
      prisma.aIRequestLog.groupBy({
        by: ['operation'],
        where: { createdAt: { gte: since } },
        _sum: { costUsd: true },
        _count: true,
      }),
      prisma.aIRequestLog.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, costUsd: true, success: true },
      }),
    ]);

    const failedCount = await prisma.aIRequestLog.count({
      where: { createdAt: { gte: since }, success: false },
    });

    return { totals, byProvider, byOperation, dailyRows, failedCount };
  },

  async listOrders(params: ListOrdersParams) {
    const where: Prisma.OrderWhereInput = params.status ? { status: params.status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total };
  },

  async getBillingOverview() {
    const [revenueAgg, paidCount, activeProCount, totalOrderCount] = await Promise.all([
      prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { amountPaise: true } }),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.user.count({ where: { plan: 'PRO', proExpiresAt: { gt: new Date() } } }),
      prisma.order.count(),
    ]);

    return {
      totalRevenuePaise: revenueAgg._sum.amountPaise ?? 0,
      paidOrderCount: paidCount,
      totalOrderCount,
      activeProUserCount: activeProCount,
    };
  },

  createFlag(data: CreateFlagData) {
    return prisma.contentFlag.create({
      data,
      include: { flaggedByUser: { select: { id: true, name: true, email: true } } },
    });
  },

  async listFlags(params: ListFlagsParams) {
    const where: Prisma.ContentFlagWhereInput = params.status ? { status: params.status } : {};

    const [flags, total] = await Promise.all([
      prisma.contentFlag.findMany({
        where,
        include: {
          flaggedByUser: { select: { id: true, name: true, email: true } },
          resolvedByUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.contentFlag.count({ where }),
    ]);

    return { flags, total };
  },

  findFlagById(id: string) {
    return prisma.contentFlag.findUnique({ where: { id } });
  },

  resolveFlag(id: string, resolvedByUserId: string, resolutionNote: string) {
    return prisma.contentFlag.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedByUserId, resolutionNote, resolvedAt: new Date() },
    });
  },
};