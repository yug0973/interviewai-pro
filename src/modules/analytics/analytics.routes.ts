import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { requireAuth } from '../../common/middleware/requireAuth';

const router = Router();

router.use(requireAuth);

router.get('/overview', analyticsController.overview);
router.get('/resumes/history', analyticsController.resumeHistory);
router.get('/interviews/history', analyticsController.interviewHistory);
router.get('/skill-gaps', analyticsController.skillGaps);

export { router as analyticsRoutes };