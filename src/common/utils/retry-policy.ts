/**
 * Exponential-backoff retry policy for outbound calls to external services
 * (email provider, payment gateway, CDN invalidation).
 *
 * A transient fault - a dropped socket, or a 503 from a provider that is
 * mid-deploy - should not surface as a user-visible payment or email failure
 * that needs manual intervention. Client errors (4xx) are never retried: they
 * are deterministic, so replaying them only multiplies load on the provider.
 *
 * This module deliberately imports nothing: no NestJS, no prom-client, no HTTP
 * client. That keeps it unit-testable without a DI container and reusable from
 * services, workers and scheduled tasks alike. Observability is exposed through
 * the `onRetry` hook rather than a hard dependency on a metrics registry - see
 * `external-call-retry.metrics.ts` for the Prometheus counter wiring.
 *
 * Issue #886.
 */

export interface RetryPolicy {
  /** Retries attempted *after* the initial call, so `3` allows up to 4 calls. */
  maxRetries: number;
  /** Delay before the first retry, in milliseconds. */
  initialDelayMs: number;
  /** Growth factor applied to the delay after each failed attempt. */
  backoffMultiplier: number;
  /** Ceiling for a single delay, applied before jitter. */
  maxDelayMs: number;
  /**
   * Full jitter spreads each delay uniformly across `[0, computed]`, so a fleet
   * of callers recovering from the same outage does not stampede the provider
   * in lockstep.
   */
  fullJitter: boolean;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 1_000,
  backoffMultiplier: 2,
  maxDelayMs: 30_000,
  fullJitter: true,
};

export function resolveRetryPolicy(overrides: Partial<RetryPolicy> = {}): RetryPolicy {
  return { ...DEFAULT_RETRY_POLICY, ...overrides };
}

/** Socket and DNS level codes that represent a transient network fault. */
export const TRANSIENT_ERROR_CODES: readonly string[] = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ERR_SOCKET_CONNECTION_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
];

/**
 * Decides whether a status code is worth another attempt. 5xx is transient
 * except 501 Not Implemented, which is a permanent capability gap. 408 and 429
 * are 4xx but explicitly invite the caller to try again.
 */
export function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) {
    return true;
  }
  return status >= 500 && status !== 501;
}

/**
 * Pulls an HTTP status out of the various error shapes this codebase sees:
 * Axios (`response.status`), the AWS SDK v3 (`$metadata.httpStatusCode`),
 * Nodemailer (`responseCode`) and plain `status` / `statusCode` fields.
 */
export function extractStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    responseCode?: unknown;
    response?: { status?: unknown };
    $metadata?: { httpStatusCode?: unknown };
  };

  const sources = [
    candidate.response?.status,
    candidate.$metadata?.httpStatusCode,
    candidate.status,
    candidate.statusCode,
    candidate.responseCode,
  ];

  for (const source of sources) {
    if (typeof source === 'number' && Number.isFinite(source)) {
      return source;
    }
  }

  return undefined;
}

/** Reads a Node-style string error code, if present. */
export function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

/**
 * Default transience test. A status code, when present, is authoritative -
 * a 400 carrying `code: 'ECONNRESET'` is still a client error. Failures with
 * neither a status nor a known socket code are treated as permanent so that
 * programming errors are never silently replayed three times.
 */
export function isTransientError(error: unknown): boolean {
  const status = extractStatusCode(error);
  if (status !== undefined) {
    return isRetryableStatus(status);
  }

  const code = extractErrorCode(error);
  if (code !== undefined) {
    return TRANSIENT_ERROR_CODES.includes(code);
  }

  return false;
}

/**
 * Delay before retry number `attempt` (1-based), capped at `maxDelayMs` and
 * optionally jittered. `random` is injectable so tests stay deterministic.
 */
export function computeRetryDelayMs(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  random: () => number = Math.random,
): number {
  const normalisedAttempt = Math.max(1, Math.trunc(attempt));
  const exponential =
    policy.initialDelayMs * Math.pow(policy.backoffMultiplier, normalisedAttempt - 1);
  const capped = Math.min(exponential, policy.maxDelayMs);

  if (!policy.fullJitter) {
    return Math.round(capped);
  }

  return Math.round(random() * capped);
}

export interface RetryAttemptContext {
  /** 1-based index of the retry about to be performed. */
  attempt: number;
  /** Delay applied before this retry, in milliseconds. */
  delayMs: number;
  /** The failure that triggered this retry. */
  error: unknown;
  /** Label identifying the external dependency, when supplied. */
  service?: string;
}

export interface RetryWithPolicyOptions {
  /** Partial overrides merged over `DEFAULT_RETRY_POLICY`. */
  policy?: Partial<RetryPolicy>;
  /** Dependency name used as the metric label, e.g. `'email'`. */
  service?: string;
  /** Overrides the default transience classification. */
  isTransient?: (error: unknown) => boolean;
  /** Invoked immediately before each retry sleep. */
  onRetry?: (context: RetryAttemptContext) => void;
  /** Injectable for tests, so specs never wait on real timers. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable jitter source, for deterministic tests. */
  random?: () => number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `operation`, retrying transient failures with exponential backoff.
 *
 * The operation receives the 1-based attempt number, which is useful for
 * logging or for varying an idempotency key. Once the budget is exhausted the
 * original error is rethrown unchanged, so callers keep their existing error
 * handling.
 */
export async function retryWithPolicy<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryWithPolicyOptions = {},
): Promise<T> {
  const policy = resolveRetryPolicy(options.policy);
  const isTransient = options.isTransient ?? isTransientError;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastError: unknown;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt += 1) {
    try {
      return await operation(attempt + 1);
    } catch (error) {
      lastError = error;

      const budgetExhausted = attempt === policy.maxRetries;
      if (budgetExhausted || !isTransient(error)) {
        throw error;
      }

      const retryIndex = attempt + 1;
      const delayMs = computeRetryDelayMs(retryIndex, policy, random);

      options.onRetry?.({
        attempt: retryIndex,
        delayMs,
        error,
        service: options.service,
      });

      await sleep(delayMs);
    }
  }

  // Unreachable: the loop above either returns or throws.
  throw lastError;
}
