import { adminRepository } from './admin.repository';
import { AppError } from '../../common/errors/AppError';
import type {
  ListUsersQuery,
  ChangeRoleInput,
  ListOrdersQuery,
  CreateFlagInput,
  ListFlagsQuery,
} from './admin.schema';

const AI_USAGE_WINDOW_DAYS = 30;

export const adminService = {
  async listUsers(query: ListUsersQuery) {
    const { users, total } = await adminRepository.listUsers(query);
    return { users, total, page: query.page, pageSize: query.pageSize };
  },

  async getUserDetail(userId: string) {
    const user = await adminRepository.findUserDetail(userId);
    if (!user) {
      throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    }
    return user;
  },

  async suspendUser(userId: string) {
    return adminRepository.setSuspended(userId, true);
  },

  async unsuspendUser(userId: string) {
    return adminRepository.setSuspended(userId, false);
  },

  async changeUserRole(userId: string, input: ChangeRoleInput) {
    return adminRepository.setRole(userId, input.role);
  },

  /**
   * Reshapes raw AIRequestLog rows into a UI-ready dashboard: totals,
   * per-provider and per-operation breakdowns, error rate, and a daily cost
   * series bucketed by calendar day (UTC) over the trailing 30 days.
   */
  async getAiUsageDashboard() {
    const { totals, byProvider, byOperation, dailyRows, failedCount } =
      await adminRepository.getAiUsageSummary(AI_USAGE_WINDOW_DAYS);

    const dailyCostMap = new Map<string, number>();
    for (const row of dailyRows as Array<{ createdAt: Date; costUsd: number; success: boolean }>) {
      const day = row.createdAt.toISOString().slice(0, 10);
      dailyCostMap.set(day, (dailyCostMap.get(day) ?? 0) + row.costUsd);
    }
    const dailyCost = Array.from(dailyCostMap.entries())
      .map(([date, costUsd]) => ({ date, costUsd: Math.round(costUsd * 10000) / 10000 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalRequests = totals._count;

    return {
      windowDays: AI_USAGE_WINDOW_DAYS,
      totalCostUsd: totals._sum.costUsd ?? 0,
      totalTokens: totals._sum.totalTokens ?? 0,
      totalRequests,
      failedRequests: failedCount,
      errorRate: totalRequests > 0 ? Math.round((failedCount / totalRequests) * 1000) / 10 : 0,
      byProvider: (byProvider as Array<{ provider: string; _sum: { costUsd: number | null; totalTokens: number | null }; _count: number }>).map(
        (row) => ({
          provider: row.provider,
          costUsd: row._sum.costUsd ?? 0,
          totalTokens: row._sum.totalTokens ?? 0,
          requestCount: row._count,
        })
      ),
      byOperation: (byOperation as Array<{ operation: string; _sum: { costUsd: number | null }; _count: number }>).map((row) => ({
        operation: row.operation,
        costUsd: row._sum.costUsd ?? 0,
        requestCount: row._count,
      })),
      dailyCost,
    };
  },

  async listOrders(query: ListOrdersQuery) {
    const { orders, total } = await adminRepository.listOrders(query);
    return { orders, total, page: query.page, pageSize: query.pageSize };
  },

  async getBillingOverview() {
    const overview = await adminRepository.getBillingOverview();
    return {
      ...overview,
      totalRevenueInr: overview.totalRevenuePaise / 100,
    };
  },

  async createFlag(adminUserId: string, input: CreateFlagInput) {
    return adminRepository.createFlag({
      type: input.type,
      targetId: input.targetId,
      reason: input.reason,
      flaggedByUserId: adminUserId,
    });
  },

  async listFlags(query: ListFlagsQuery) {
    const { flags, total } = await adminRepository.listFlags(query);
    return { flags, total, page: query.page, pageSize: query.pageSize };
  },

  async resolveFlag(flagId: string, adminUserId: string, resolutionNote: string) {
    const flag = await adminRepository.findFlagById(flagId);
    if (!flag) {
      throw AppError.notFound('Flag not found', 'FLAG_NOT_FOUND');
    }
    if (flag.status === 'RESOLVED') {
      throw AppError.badRequest('This flag has already been resolved', 'FLAG_ALREADY_RESOLVED');
    }
    return adminRepository.resolveFlag(flagId, adminUserId, resolutionNote);
  },
};