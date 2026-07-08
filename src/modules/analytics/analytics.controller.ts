import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';

export const analyticsController = {
  async resumeHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await analyticsService.getResumeAtsHistory(req.user!.id);
      res.status(200).json({ history });
    } catch (err) {
      next(err);
    }
  },

  async interviewHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await analyticsService.getInterviewScoreHistory(req.user!.id);
      res.status(200).json({ history });
    } catch (err) {
      next(err);
    }
  },

  async skillGaps(req: Request, res: Response, next: NextFunction) {
    try {
      const skillGaps = await analyticsService.getSkillGaps(req.user!.id);
      res.status(200).json({ skillGaps });
    } catch (err) {
      next(err);
    }
  },

  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const overview = await analyticsService.getOverview(req.user!.id);
      res.status(200).json(overview);
    } catch (err) {
      next(err);
    }
  },
};