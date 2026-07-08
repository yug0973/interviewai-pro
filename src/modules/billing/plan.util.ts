export interface PlanAwareUser {
  plan: string; // "FREE" | "PRO"
  proExpiresAt: Date | null;
}

/**
 * A user is only actually Pro if their plan says PRO *and* the expiry hasn't
 * passed - a lapsed Pro user (past proExpiresAt) is treated as FREE without
 * needing a background job to flip `plan` back; this check is the source of
 * truth everywhere Pro status matters (billing status endpoint, and the
 * free-tier usage gates in Resume/Interview).
 */
export function isProActive(user: PlanAwareUser): boolean {
  return user.plan === 'PRO' && user.proExpiresAt !== null && user.proExpiresAt.getTime() > Date.now();
}