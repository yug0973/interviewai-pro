import { Router } from 'express';
import { requireAuth } from '../../common/middleware/requireAuth';
import { realtimeController } from './realtime.controller';

const router = Router();

router.use(requireAuth);

router.post('/sessions', (req, res, next) => realtimeController.createSession(req, res, next));
router.get('/sessions/:id', (req, res, next) => realtimeController.getSession(req, res, next));
router.post('/sessions/:id/finalize', (req, res, next) =>
  realtimeController.finalizeSession(req, res, next)
);

export const realtimeRoutes = router;
