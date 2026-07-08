import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './common/middleware/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { resumeRoutes } from './modules/resume/resume.routes';
import { interviewRoutes } from './modules/interview/interview.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { billingRoutes } from './modules/billing/billing.routes';
import { billingWebhookRoutes } from './modules/billing/billing.webhook.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { jobMatchRoutes } from './modules/job-match/job-match.routes';
import { realtimeRoutes } from './modules/realtime/realtime.routes';
import { aiProvider } from './integrations/ai/ai.factory';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) return callback(null, true);
        if (origin === env.CLIENT_ORIGIN || origin.startsWith('http://localhost:')) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true, // required so the refresh-token cookie is sent/received
    })
  );

  // Must be mounted BEFORE express.json() below - Razorpay webhook signature
  // verification needs the exact raw request body bytes, not re-serialized JSON.
  app.use('/api/billing/webhook', billingWebhookRoutes);

  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/health/ai', async (_req, res) => {
    const healthy = await aiProvider.healthCheck();
    res.status(healthy ? 200 : 503).json({ provider: aiProvider.name, healthy });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/resumes', resumeRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/job-match', jobMatchRoutes);
  app.use('/api/realtime', realtimeRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}