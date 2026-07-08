import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { env } from '../../config/env';
import { AppError } from '../../common/errors/AppError';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth', // only sent to auth endpoints (refresh/logout)
};

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(env.REFRESH_COOKIE_NAME, token, {
    ...REFRESH_COOKIE_OPTIONS,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(env.REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
}

export const authController = {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, tokens } = await authService.signup(req.body);
      setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
      res.status(201).json({ user, accessToken: tokens.accessToken });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, tokens } = await authService.login(req.body);
      setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
      res.status(200).json({ user, accessToken: tokens.accessToken });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const rawToken = req.cookies?.[env.REFRESH_COOKIE_NAME];
      if (!rawToken) {
        throw AppError.unauthorized('No refresh token provided', 'MISSING_REFRESH_TOKEN');
      }

      const tokens = await authService.refresh(rawToken);
      setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
      res.status(200).json({ accessToken: tokens.accessToken });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const rawToken = req.cookies?.[env.REFRESH_COOKIE_NAME];
      await authService.logout(rawToken);
      clearRefreshCookie(res);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      res.status(200).json({ user: req.user });
    } catch (err) {
      next(err);
    }
  },
};
