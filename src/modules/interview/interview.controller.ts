import { Request, Response, NextFunction } from 'express';
import { interviewService } from './interview.service';

export const interviewController = {
  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await interviewService.startSession(req.user!.id, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async answer(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await interviewService.submitAnswer(
        req.user!.id,
        req.params.id,
        req.body.answerText
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const sessions = await interviewService.listSessions(req.user!.id);
      res.status(200).json({ sessions });
    } catch (err) {
      next(err);
    }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await interviewService.getSession(req.user!.id, req.params.id);
      res.status(200).json({ session });
    } catch (err) {
      next(err);
    }
  },

  async abandon(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await interviewService.abandonSession(req.user!.id, req.params.id);
      res.status(200).json({ session });
    } catch (err) {
      next(err);
    }
  },
};
