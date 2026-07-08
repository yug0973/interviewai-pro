import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/AppError';
import { startRealtimeSessionSchema } from './realtime.schema';
import { realtimeAgentService } from './realtime-agent.service';

export class RealtimeController {
  /**
   * POST /api/realtime/sessions
   * Creates a new real-time voice & video interview session.
   */
  async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const input = startRealtimeSessionSchema.parse(req.body);

      // Verify resume ownership if provided
      if (input.resumeId) {
        const resume = await prisma.resume.findUnique({
          where: { id: input.resumeId },
          select: { userId: true },
        });
        if (!resume || resume.userId !== userId) {
          throw new AppError('Resume not found or does not belong to you', 404, 'NOT_FOUND');
        }
      }

      const session = await prisma.interviewSession.create({
        data: {
          userId,
          targetRole: input.targetRole,
          interviewType: input.interviewType,
          difficulty: input.difficulty,
          mode: 'REALTIME',
          roomState: 'DEVICE_CHECK',
          status: 'IN_PROGRESS',
          resumeId: input.resumeId,
          jobDescriptionText: input.jobDescriptionText,
          warningCount: 0,
          maxWarnings: 3,
          integrityStatus: 'PASSED',
        },
        include: {
          resume: {
            select: { id: true, label: true },
          },
        },
      });

      return res.status(201).json({
        session,
        wsPath: `/api/realtime/interview`,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/realtime/sessions/:id
   * Retrieves full real-time interview state, messages, proctoring events, and evaluation.
   */
  async getSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const session = await prisma.interviewSession.findUnique({
        where: { id },
        include: {
          messages: { orderBy: { order: 'asc' } },
          events: { orderBy: { createdAt: 'asc' } },
          evaluation: true,
          resume: { select: { id: true, label: true } },
        },
      });

      if (!session) {
        throw new AppError('Interview session not found', 404, 'NOT_FOUND');
      }

      if (session.userId !== userId && req.user!.role !== 'ADMIN') {
        throw new AppError('Access forbidden', 403, 'FORBIDDEN');
      }

      return res.status(200).json({ session });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/realtime/sessions/:id/finalize
   * Explicitly concludes and summarizes a session.
   */
  async finalizeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const session = await prisma.interviewSession.findUnique({
        where: { id },
        select: { userId: true, status: true },
      });

      if (!session) {
        throw new AppError('Interview session not found', 404, 'NOT_FOUND');
      }

      if (session.userId !== userId && req.user!.role !== 'ADMIN') {
        throw new AppError('Access forbidden', 403, 'FORBIDDEN');
      }

      const evaluation = await realtimeAgentService.finalizeRealtimeSession(id);
      return res.status(200).json({ evaluation });
    } catch (err) {
      next(err);
    }
  }
}

export const realtimeController = new RealtimeController();
