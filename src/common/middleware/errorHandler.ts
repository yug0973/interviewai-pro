import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten(),
      },
    });
  }

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational AppError', { message: err.message, stack: err.stack });
    }
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  const stack = err instanceof Error ? err.stack : undefined;
  const raw = err instanceof Error ? undefined : safeStringify(err);

  if (
    message.includes("Can't reach database") ||
    message.includes('P1001') ||
    message.includes('PrismaClientInitializationError') ||
    (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'PrismaClientInitializationError')
  ) {
    logger.error('Database connection error', { message });
    return res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database server is unreachable. Please make sure PostgreSQL is running on port 5432 (e.g. run "docker compose up postgres -d").',
      },
    });
  }

  logger.error('Unhandled error', { message, stack, raw, path: req.path, method: req.method });

  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}