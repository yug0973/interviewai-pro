import { Request, Response, NextFunction } from 'express';
import { resumeService } from './resume.service';
import { AppError } from '../../common/errors/AppError';

export const resumeController = {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw AppError.badRequest('No file uploaded. Attach a file under the "resume" field.', 'MISSING_FILE');
      }
      const resume = await resumeService.uploadResume(req.user!.id, req.file, req.body);
      res.status(202).json({ resume });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const resumes = await resumeService.listResumes(req.user!.id);
      res.status(200).json({ resumes });
    } catch (err) {
      next(err);
    }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const resume = await resumeService.getResume(req.user!.id, req.params.id);
      res.status(200).json({ resume });
    } catch (err) {
      next(err);
    }
  },

  async setPrimary(req: Request, res: Response, next: NextFunction) {
    try {
      const resume = await resumeService.setPrimary(req.user!.id, req.params.id);
      res.status(200).json({ resume });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await resumeService.deleteResume(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async compare(req: Request, res: Response, next: NextFunction) {
    try {
      const { a, b } = req.query as { a: string; b: string };
      const comparison = await resumeService.compareResumes(req.user!.id, a, b);
      res.status(200).json(comparison);
    } catch (err) {
      next(err);
    }
  },
};
