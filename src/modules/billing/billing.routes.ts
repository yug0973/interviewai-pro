import { Router } from 'express';
import { billingController } from './billing.controller';
import { requireAuth } from '../../common/middleware/requireAuth';
import { validate } from '../../common/middleware/validate';
import { verifyPaymentSchema } from './billing.schema';

const router = Router();

router.use(requireAuth);

router.post('/orders', billingController.createOrder);
router.post('/orders/verify', validate(verifyPaymentSchema), billingController.verifyPayment);
router.get('/status', billingController.status);

export { router as billingRoutes };