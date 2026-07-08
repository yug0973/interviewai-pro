import { Router } from 'express';
import multer from 'multer';
import { resumeController } from './resume.controller';
import { requireAuth } from '../../common/middleware/requireAuth';
import { validate } from '../../common/middleware/validate';
import { rateLimiter } from '../../common/middleware/rateLimiter';
import {
  uploadResumeSchema,
  resumeIdParamSchema,
  compareResumesSchema,
} from './resume.schema';
import { MAX_RESUME_FILE_SIZE_BYTES } from './resume.validation';

const router = Router();

// Memory storage: files are small (<=10MB) and are streamed straight to
// Cloudinary + read into pdf-parse/mammoth, so there's no need to touch disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_FILE_SIZE_BYTES },
});

// AI analysis costs money/quota per call, so uploads get their own tighter
// limit on top of any global rate limiting.
const uploadRateLimit = rateLimiter({
  windowSeconds: 60 * 60,
  max: 10,
  keyPrefix: 'resume-upload',
  keyFn: (req) => req.user?.id ?? req.ip ?? 'anonymous',
});

router.use(requireAuth);

router.post(
  '/',
  uploadRateLimit,
  upload.single('resume'),
  validate(uploadResumeSchema),
  resumeController.upload
);
router.get('/', resumeController.list);
router.get('/compare', validate(compareResumesSchema), resumeController.compare);
router.get('/:id', validate(resumeIdParamSchema), resumeController.get);
router.patch('/:id/primary', validate(resumeIdParamSchema), resumeController.setPrimary);
router.delete('/:id', validate(resumeIdParamSchema), resumeController.remove);

export { router as resumeRoutes };
