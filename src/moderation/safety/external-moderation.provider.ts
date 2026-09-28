/**
 * Issue #805 — ContentSafetyService must use a real moderation provider rather than
 * the trivially-bypassable keyword regex.
 *
 * This module defines the contract adapters (OpenAI, AWS Rekognition, Perspective, …)
 * implement. Adapters MUST throw {@link ExternalModerationUnavailableError} on any
 * failure mode that the caller can recover from (network error, auth error, timeout,
 * malformed response) so the {@link ContentSafetyService} can degrade to the keyword
 * filter via its circuit-breaker fallback instead of returning 500.
 */

/**
 * Score returned in the closed interval [0, 1].
 *  - `0` means definitively safe.
 *  - `1` means definitively unsafe.
 * Implementations are free to choose any continuous scale in between; the caller's
 * threshold logic interprets the value.
 */
export type ModerationScore = number;

/**
 * Any external moderation provider must implement this contract.
 *
 * Implementations are responsible for normalising input text — including stripping
 * Unicode homoglyphs, zero-width characters, and other tricks that the legacy
 * keyword regex could not catch. Callers must NOT pre-normalise before invoking
 * the adapter because different adapters may want different normalisation rules.
 */
export interface ExternalModerationProvider {
  /** Stable identifier used for circuit-breaker keying and observability. */
  readonly name: string;

  /**
   * Returns a {@link ModerationScore} for the given text.
   * Throws {@link ExternalModerationUnavailableError} on recoverable failures so
   * the caller can fall back without leaking a 500.
   */
  scoreContent(text: string): Promise<ModerationScore>;
}

/**
 * Marker error for transient / recoverable provider failure. The caller (typically
 * ContentSafetyService inside its circuit breaker) interprets this as "fall back
 * gracefully" rather than "propagate to the user as 500".
 */
export class ExternalModerationUnavailableError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ExternalModerationUnavailableError';
  }
}

/**
 * String DI token used to register / consume an {@link ExternalModerationProvider} in
 * NestJS modules. A constant keeps the token name consistent across producers and
 * consumers and prevents accidental typos.
 */
export const EXTERNAL_MODERATION_PROVIDER = 'ExternalModerationProvider';
