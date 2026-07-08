import { NextFunction, Request, Response } from 'express';
import { redis } from '../../config/redis';
import { AppError } from '../errors/AppError';

interface RateLimitOptions {
  windowSeconds: number;
  max: number;
  keyPrefix: string;
  keyFn?: (req: Request) => string;
}

const memoryLimiter = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(options: RateLimitOptions) {
  const { windowSeconds, max, keyPrefix, keyFn } = options;

  return async function rateLimiterMiddleware(req: Request, _res: Response, next: NextFunction) {
    const identity = keyFn ? keyFn(req) : (req.ip || '127.0.0.1');
    const key = `ratelimit:${keyPrefix}:${identity}`;

    try {
      if (redis.status === 'ready') {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, windowSeconds);
        }

        if (count > max) {
          return next(
            new AppError('Too many requests. Please try again later.', 429, 'RATE_LIMITED')
          );
        }
        return next();
      }
    } catch (err) {
      if (err instanceof AppError) return next(err);
      // Redis is offline, fall through to in-memory fallback
    }

    // In-memory sliding rate limiter fallback (bypassed in test environment)
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const now = Date.now();
    const entry = memoryLimiter.get(key);

    if (!entry || now > entry.resetAt) {
      memoryLimiter.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      return next(
        new AppError('Too many requests. Please try again later.', 429, 'RATE_LIMITED')
      );
    }

    next();
  };
}
