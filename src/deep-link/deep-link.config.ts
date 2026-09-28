const DEFAULT_TTL_MS = 60_000;
const DEFAULT_LIMIT = 60;
const DEFAULT_REDIRECT_LIMIT = 20;

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Deep-link throttling can be tuned with:
 * DEEP_LINK_RATE_LIMIT_TTL_MS, DEEP_LINK_RATE_LIMIT_DEFAULT, and
 * DEEP_LINK_RATE_LIMIT_REDIRECT.
 */
export const deepLinkRateLimitConfig = {
  ttlMs: readPositiveInteger(process.env.DEEP_LINK_RATE_LIMIT_TTL_MS, DEFAULT_TTL_MS),
  defaultLimit: readPositiveInteger(process.env.DEEP_LINK_RATE_LIMIT_DEFAULT, DEFAULT_LIMIT),
  redirectLimit: readPositiveInteger(
    process.env.DEEP_LINK_RATE_LIMIT_REDIRECT,
    DEFAULT_REDIRECT_LIMIT,
  ),
};
