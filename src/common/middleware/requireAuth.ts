import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or malformed Authorization header');
    }

    const token = header.slice('Bearer '.length);
    const payload = verifyAccessToken(token);

    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    // jwt.verify throws distinct error types (TokenExpiredError,
    // JsonWebTokenError for bad signature/malformed token, NotBeforeError)
    // that all get flattened into the same generic 401 below - without
    // logging which one it actually was, a signature/secret mismatch is
    // indistinguishable from a genuinely expired token.
    if (!(err instanceof AppError)) {
      logger.warn('Access token verification failed', {
        errorName: err instanceof Error ? err.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        path: req.path,
      });
    }
    next(AppError.unauthorized('Invalid or expired access token'));
  }
}