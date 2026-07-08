import { Request, Response, NextFunction } from 'express';
import { jobMatchService } from './job-match.service';

export const jobMatchController = {
  async match(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await jobMatchService.match(req.user!.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};
