import { Request, Response, NextFunction } from 'express';
import { billingService } from './billing.service';

export const billingController = {
  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await billingService.createProOrder(req.user!.id);
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  },

  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await billingService.verifyPayment(req.user!.id, req.body);
      res.status(200).json(status);
    } catch (err) {
      next(err);
    }
  },

  async status(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await billingService.getPlanStatus(req.user!.id);
      res.status(200).json(status);
    } catch (err) {
      next(err);
    }
  },

  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.header('x-razorpay-signature') ?? '';
      const rawBody = (req.body as Buffer).toString('utf8');
      const result = await billingService.handleWebhook(rawBody, signature);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};