import { Router } from 'express';
import { adminController } from './admin.controller';
import { requireAuth } from '../../common/middleware/requireAuth';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import {
  listUsersQuerySchema,
  userIdParamSchema,
  changeRoleSchema,
  listOrdersQuerySchema,
  createFlagSchema,
  listFlagsQuerySchema,
  resolveFlagSchema,
} from './admin.schema';

const router = Router();

// Every route in this module is admin-only - no exceptions.
router.use(requireAuth, requireRole('ADMIN'));

// --- Users ---
router.get('/users', validate(listUsersQuerySchema), adminController.listUsers);
router.get('/users/:id', validate(userIdParamSchema), adminController.getUser);
router.patch('/users/:id/suspend', validate(userIdParamSchema), adminController.suspendUser);
router.patch('/users/:id/unsuspend', validate(userIdParamSchema), adminController.unsuspendUser);
router.patch('/users/:id/role', validate(changeRoleSchema), adminController.changeUserRole);

// --- AI cost/usage dashboard ---
router.get('/ai-usage', adminController.aiUsage);

// --- Billing overview ---
router.get('/billing/overview', adminController.billingOverview);
router.get('/billing/orders', validate(listOrdersQuerySchema), adminController.listOrders);

// --- Content moderation flags ---
router.post('/flags', validate(createFlagSchema), adminController.createFlag);
router.get('/flags', validate(listFlagsQuerySchema), adminController.listFlags);
router.patch('/flags/:id/resolve', validate(resolveFlagSchema), adminController.resolveFlag);

export { router as adminRoutes };