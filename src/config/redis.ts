import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../common/logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false, // Don't hang indefinitely if Redis is down
  connectTimeout: 2000,
  retryStrategy(times) {
    if (times > 10) return null; // stop spamming if down
    return Math.min(times * 1000, 5000);
  },
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis connection error', { err: err.message }));
