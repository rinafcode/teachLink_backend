import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnhancedCircuitBreakerService } from '../../common/services/circuit-breaker.service';
import {
  EXTERNAL_MODERATION_PROVIDER,
  ExternalModerationProvider,
  ModerationScore,
} from './external-moderation.provider';

/**
 * Issue #805 — Content safety scorer with circuit-breaker-protected external
 * provider and a synchronous keyword fallback.
 *
 * Why both:
 *  - `keywordScore()` is fast, deterministic, and wrong only in adversarial
 *    cases (Unicode homoglyphs, zero-width characters, deliberate misspelling).
 *  - `provider.scoreContent()` is correct under those adversarial cases but is
 *    a remote call — it can fail, time out, or be unavailable.
 *
 * Behaviour:
 *  - We call the provider through {@link EnhancedCircuitBreakerService} using a
 *    *static* breaker key. A static key is required because opossum stores
 *    breaker instances in a Map keyed by the key string — dynamic keys (e.g.
 *    per-IP) would leak heap.
 *  - On any {@link ExternalModerationUnavailableError} or breaker-open condition,
 *    the provided `fallback()` resolves with the keyword score so the request
 *    completes successfully with degraded accuracy.
 *  - When the provider succeeds we return `max(external, local)` so a clean
 *    external pass does NOT mask a homoglyphed keyword match.
 */
@Injectable()
export class ContentSafetyService {
  /**
   * Static breaker key. Do NOT make this dynamic (e.g. per-IP / per-content),
   * otherwise opossum's internal Map grows unbounded.
   */
  static readonly CIRCUIT_BREAKER_KEY = 'content-safety:external-moderation';

  private readonly logger = new Logger(ContentSafetyService.name);
  private readonly breakerTimeoutMs: number;
  private readonly providerEnabled: boolean;

  constructor(
    @Inject(EXTERNAL_MODERATION_PROVIDER)
    private readonly provider: ExternalModerationProvider,
    private readonly circuitBreaker: EnhancedCircuitBreakerService,
    private readonly configService: ConfigService,
  ) {
    this.breakerTimeoutMs = this.configService.get<number>(
      'OPENAI_MODERATION_TIMEOUT_MS',
      500,
    );
    this.providerEnabled = this.configService.get<boolean>(
      'OPENAI_MODERATION_ENABLED',
      true,
    );
  }

  /**
   * Returns a safety score in [0, 1] (higher = more unsafe).
   *
   * Always resolves successfully — provider failure is masked by the
   * circuit breaker fallback. Only throws if the breaker fallback itself
   * throws, which should be impossible by construction.
   */
  async scoreContent(content: string): Promise<ModerationScore> {
    if (!content || !content.trim()) return 0;

    const keywordScore = this.keywordScore(content);

    if (!this.providerEnabled) {
      // Feature off — pure keyword filter.
      return keywordScore;
    }

    try {
      const external = await this.circuitBreaker.execute(
        ContentSafetyService.CIRCUIT_BREAKER_KEY,
        () => this.provider.scoreContent(content),
        {
          name: ContentSafetyService.CIRCUIT_BREAKER_KEY,
          timeout: this.breakerTimeoutMs,
          fallback: (err: Error) => {
            this.logger.warn(
              `External moderation unavailable (${err.message}); falling back to keyword filter`,
            );
            return keywordScore;
          },
        },
      );

      // Combine: external pass with masked homoglyph still trips the keyword filter.
      return Math.max(external, keywordScore);
    } catch (err) {
      // Last-resort net — if even the fallback threw (shouldn't happen), degrade
      // to keyword-only and log loudly so an operator investigates.
      this.logger.error(
        `ContentSafetyService fallback chain failed: ${(err as Error).message}`,
      );
      return keywordScore;
    }
  }

  /**
   * Synchronous local keyword heuristic. Preserved as a public method so it
   * stays callable from contexts without async (legacy callers, tests).
   * Note: this is the *same* trivially-bypassable regex the issue identified —
   * it is intentionally retained ONLY as a fallback. The primary scoring path
   * is `scoreContent()`.
   */
  keywordScore(content: string): ModerationScore {
    if (!content) return 0;
    let score = 0;
    if (/violence|hate|explicit/i.test(content)) score += 0.8;
    if (/spam|scam/i.test(content)) score += 0.5;
    return Math.min(score, 1);
  }
}
