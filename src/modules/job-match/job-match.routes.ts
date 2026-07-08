import { Router } from 'express';
import { jobMatchController } from './job-match.controller';
import { requireAuth } from '../../common/middleware/requireAuth';
import { validate } from '../../common/middleware/validate';
import { rateLimiter } from '../../common/middleware/rateLimiter';
import { matchJobDescriptionSchema } from './job-match.schema';

const router = Router();

const matchRateLimit = rateLimiter({
  windowSeconds: 60 * 60,
  max: 30,
  keyPrefix: 'job-match',
  keyFn: (req) => req.user?.id ?? req.ip ?? 'anonymous',
});

router.use(requireAuth);
router.use(matchRateLimit);

router.post('/', validate(matchJobDescriptionSchema), jobMatchController.match);

export { router as jobMatchRoutes };
