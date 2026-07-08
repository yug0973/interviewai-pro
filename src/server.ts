import { createApp } from './app';
import { env } from './config/env';
import { logger } from './common/logger';
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { startResumeAnalysisWorker } from './jobs/resume-analysis.worker';
import { setupWebSocketServer } from './realtime/websocket.server';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`InterviewAI Pro backend listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

const wss = setupWebSocketServer(server);

const resumeAnalysisWorker = startResumeAnalysisWorker();
logger.info('Resume analysis worker started');

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  wss.close(() => {
    logger.info('WebSocket gateway closed');
  });
  server.close(async () => {
    await resumeAnalysisWorker.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
