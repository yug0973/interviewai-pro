import { Router } from 'express';
import { interviewController } from './interview.controller';
import { requireAuth } from '../../common/middleware/requireAuth';
import { validate } from '../../common/middleware/validate';
import { rateLimiter } from '../../common/middleware/rateLimiter';
import {
  startInterviewSchema,
  submitAnswerSchema,
  sessionIdParamSchema,
} from './interview.schema';

const router = Router();

// Each turn is a real AI call (question generation, follow-up, or the final
// summary), so this gets its own tighter limit on top of any global limiting.
const interviewRateLimit = rateLimiter({
  windowSeconds: 60 * 60,
  max: 100,
  keyPrefix: 'interview-turn',
  keyFn: (req) => req.user?.id ?? req.ip ?? 'anonymous',
});

router.use(requireAuth);
router.use(interviewRateLimit);

router.post('/', validate(startInterviewSchema), interviewController.start);
router.get('/', interviewController.list);
router.get('/:id', validate(sessionIdParamSchema), interviewController.get);
router.post('/:id/answer', validate(submitAnswerSchema), interviewController.answer);
router.post('/:id/abandon', validate(sessionIdParamSchema), interviewController.abandon);

export { router as interviewRoutes };
