import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service';

export const adminController = {
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.listUsers(req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await adminService.getUserDetail(req.params.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },

  async suspendUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await adminService.suspendUser(req.params.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },

  async unsuspendUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await adminService.unsuspendUser(req.params.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },

  async changeUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await adminService.changeUserRole(req.params.id, req.body);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },

  async aiUsage(_req: Request, res: Response, next: NextFunction) {
    try {
      const dashboard = await adminService.getAiUsageDashboard();
      res.status(200).json(dashboard);
    } catch (err) {
      next(err);
    }
  },

  async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.listOrders(req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async billingOverview(_req: Request, res: Response, next: NextFunction) {
    try {
      const overview = await adminService.getBillingOverview();
      res.status(200).json(overview);
    } catch (err) {
      next(err);
    }
  },

  async createFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const flag = await adminService.createFlag(req.user!.id, req.body);
      res.status(201).json({ flag });
    } catch (err) {
      next(err);
    }
  },

  async listFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.listFlags(req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async resolveFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const flag = await adminService.resolveFlag(req.params.id, req.user!.id, req.body.resolutionNote);
      res.status(200).json({ flag });
    } catch (err) {
      next(err);
    }
  },
};