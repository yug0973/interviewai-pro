import { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { AppError } from '../errors/AppError';

/** Must be mounted after requireAuth - relies on req.user being set. */
export function requireRole(...allowedRoles: Role[]) {
  return function requireRoleMiddleware(req: Request, _res: Response, next: NextFunction) {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }

    next();
  };
}
