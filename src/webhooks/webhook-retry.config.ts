/**
 * Configuration for outbound webhook delivery retries.
 *
 * Values can be overridden via environment variables so retry behaviour is
 * tunable per environment without code changes (see {@link loadWebhookRetryConfig}).
 */
export interface WebhookRetryConfig {
  /** Maximum number of delivery attempts before a webhook is dead-lettered. */
  maxRetries: number;
  /** Base delay (ms) used for the first retry. */
  initialDelayMs: number;
  /** Multiplier applied on each successive retry (exponential growth). */
  backoffMultiplier: number;
  /** Upper bound (ms) for any single backoff delay. */
  maxDelayMs: number;
  /** Apply jitter to spread out retries and avoid thundering herds. */
  jitter: boolean;
  /** Per-request HTTP timeout (ms). */
  timeoutMs: number;
}

export const DEFAULT_WEBHOOK_RETRY_CONFIG: WebhookRetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1_000,
  backoffMultiplier: 2,
  maxDelayMs: 60 * 60 * 1_000, // 1 hour
  jitter: true,
  timeoutMs: 10_000,
};

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const toBool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value === 'true' || value === '1';

/**
 * Build a {@link WebhookRetryConfig} from environment variables, falling back to
 * {@link DEFAULT_WEBHOOK_RETRY_CONFIG} for anything unset or invalid.
 */
export const loadWebhookRetryConfig = (
  env: NodeJS.ProcessEnv = process.env,
): WebhookRetryConfig => ({
  maxRetries: toInt(env.WEBHOOK_MAX_RETRIES, DEFAULT_WEBHOOK_RETRY_CONFIG.maxRetries),
  initialDelayMs: toInt(env.WEBHOOK_INITIAL_DELAY_MS, DEFAULT_WEBHOOK_RETRY_CONFIG.initialDelayMs),
  backoffMultiplier: toInt(
    env.WEBHOOK_BACKOFF_MULTIPLIER,
    DEFAULT_WEBHOOK_RETRY_CONFIG.backoffMultiplier,
  ),
  maxDelayMs: toInt(env.WEBHOOK_MAX_DELAY_MS, DEFAULT_WEBHOOK_RETRY_CONFIG.maxDelayMs),
  jitter: toBool(env.WEBHOOK_JITTER, DEFAULT_WEBHOOK_RETRY_CONFIG.jitter),
  timeoutMs: toInt(env.WEBHOOK_TIMEOUT_MS, DEFAULT_WEBHOOK_RETRY_CONFIG.timeoutMs),
});

/** Injection token for the resolved webhook retry configuration. */
export const WEBHOOK_RETRY_CONFIG = 'WEBHOOK_RETRY_CONFIG';
