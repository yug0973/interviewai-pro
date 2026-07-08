import { authRepository } from './auth.repository';
import { comparePassword, hashPassword, hashToken } from '../../common/utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/utils/jwt';
import { AppError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';
import type { SignupInput, LoginInput } from './auth.schema';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

function toSafeUser(user: { id: string; name: string; email: string; role: string }): SafeUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function issueTokenPair(userId: string, role: string): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: userId, role: role as any });
  const { token: refreshToken, jti, expiresAt } = signRefreshToken(userId);

  await authRepository.createRefreshToken({
    id: jti,
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt,
  });

  return { accessToken, refreshToken, refreshTokenExpiresAt: expiresAt };
}

export const authService = {
  async signup(input: SignupInput): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) {
      throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    const tokens = await issueTokenPair(user.id, user.role);
    logger.info('User signed up', { userId: user.id });

    return { user: toSafeUser(user), tokens };
  },

  async login(input: LoginInput): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const valid = await comparePassword(input.password, user.passwordHash);
    if (!valid) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.isSuspended) {
      throw AppError.forbidden('This account has been suspended', 'ACCOUNT_SUSPENDED');
    }

    const tokens = await issueTokenPair(user.id, user.role);
    logger.info('User logged in', { userId: user.id });

    return { user: toSafeUser(user), tokens };
  },

  /**
   * Rotates a refresh token: verifies the JWT signature, checks the DB record
   * for the jti, and if it's already revoked, treats that as evidence of
   * theft/reuse and revokes every refresh token belonging to that user.
   */
  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const record = await authRepository.findRefreshTokenById(payload.jti);

    if (!record || record.userId !== payload.sub) {
      throw AppError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    if (record.revoked) {
      // Reuse of an already-rotated token - likely theft. Nuke every session.
      await authRepository.revokeAllRefreshTokensForUser(payload.sub);
      logger.error('Refresh token reuse detected - all sessions revoked', { userId: payload.sub });
      throw AppError.unauthorized(
        'Session invalidated for security reasons. Please log in again.',
        'REFRESH_REUSE_DETECTED'
      );
    }

    if (record.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token expired', 'INVALID_REFRESH_TOKEN');
    }

    if (hashToken(rawRefreshToken) !== record.tokenHash) {
      // Signature verified but stored hash mismatch shouldn't happen unless tampered with.
      await authRepository.revokeAllRefreshTokensForUser(payload.sub);
      throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    // Rotate: revoke the used token, issue a brand new pair.
    await authRepository.revokeRefreshTokenById(record.id);

    const user = await authRepository.findUserById(payload.sub);
    if (!user) {
      throw AppError.unauthorized('User no longer exists', 'INVALID_REFRESH_TOKEN');
    }

    if (user.isSuspended) {
      await authRepository.revokeAllRefreshTokensForUser(user.id);
      throw AppError.forbidden('This account has been suspended', 'ACCOUNT_SUSPENDED');
    }

    return issueTokenPair(user.id, user.role);
  },

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;

    try {
      const payload = verifyRefreshToken(rawRefreshToken);
      await authRepository.revokeRefreshTokenById(payload.jti);
    } catch {
      // Token already invalid/expired - logout is idempotent, nothing to do.
    }
  },
};