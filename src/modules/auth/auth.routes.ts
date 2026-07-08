import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../common/middleware/validate';
import { signupSchema, loginSchema } from './auth.schema';
import { rateLimiter } from '../../common/middleware/rateLimiter';
import { requireAuth } from '../../common/middleware/requireAuth';

const router = Router();

const authRateLimit = rateLimiter({
  windowSeconds: 60,
  max: 10,
  keyPrefix: 'auth',
});

router.post('/signup', authRateLimit, validate(signupSchema), authController.signup);
router.post('/login', authRateLimit, validate(loginSchema), authController.login);
router.post('/refresh', authRateLimit, authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export { router as authRoutes };
