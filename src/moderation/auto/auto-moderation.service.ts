import { Injectable } from '@nestjs/common';
import { HfInference } from '@huggingface/inference';
import { ContentSafetyService } from '../safety/content-safety.service';

/**
 * Provides auto Moderation operations.
 *
 * Two safety scorers are available — pick the one that matches the use-case:
 *
 *  - {@link AutoModerationService.analyze} uses HuggingFace's
 *    `s-nlp/roberta_toxicity_classifier` directly. Best for low-latency
 *    bulk ingestion (course reviews, comments) where we already have
 *    HF budget and want a single-model verdict.
 *
 *  - {@link AutoModerationService.classifyContentSafety} delegates to
 *    {@link ContentSafetyService} (Issue #805): OpenAI moderation behind
 *    a static circuit-breaker key with a synchronous keyword fallback.
 *    Best for adversarial input (homoglyphs, zero-width chars) and for
 *    callers that need the `ExternalModerationProvider` swap-ability.
 *
 * `moderateContent` runs BOTH scorers in series and returns the higher
 * score so a homoglyph-bypassed HF pass cannot mask a local keyword hit.
 */
@Injectable()
export class AutoModerationService {
  private readonly hf: HfInference;

  /** Combined-score threshold above which content is flagged. */
  private readonly COMBINED_FLAG_THRESHOLD = 0.7;

  constructor(private readonly contentSafetyService: ContentSafetyService) {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
  }

  /**
   * HuggingFace-based toxicity scorer (legacy path).
   * @param content The content.
   * @returns The operation result.
   */
  async analyze(content: string): Promise<{ flagged: boolean; reasons: string[]; score: number }> {
    if (!content) {
      return { flagged: false, reasons: [], score: 0 };
    }
    try {
      const result = await this.hf.textClassification({
        model: 's-nlp/roberta_toxicity_classifier', // or 'unitary/toxic-bert'
        inputs: content,
      });

      // result is an array of { label, score }
      const toxicLabel = result.find((r) => r.label.toLowerCase().includes('toxic'));
      const score = toxicLabel ? toxicLabel.score : 0;

      return {
        flagged: score > this.COMBINED_FLAG_THRESHOLD,
        reasons: score > this.COMBINED_FLAG_THRESHOLD ? ['AI model detected toxicity'] : [],
        score,
      };
    } catch (err) {
      // HuggingFace API failed — degrade gracefully so a single API outage
      // does not block all moderation. Callers can re-run classifyContentSafety
      // for a circuit-breaker-protected second opinion.
      return { flagged: false, reasons: [`hf-unavailable:${(err as Error).message}`], score: 0 };
    }
  }

  /**
   * Issue #805 — returns the safety score from ContentSafetyService which
   * wraps the OpenAI moderation adapter via EnhancedCircuitBreakerService and
   * falls back to the local keyword filter on any provider failure.
   *
   * @param content The content.
   * @returns The same shape as {@link AutoModerationService.analyze}.
   */
  async classifyContentSafety(
    content: string,
  ): Promise<{ flagged: boolean; reasons: string[]; score: number }> {
    const score = await this.contentSafetyService.scoreContent(content);
    return {
      flagged: score > this.COMBINED_FLAG_THRESHOLD,
      reasons: score > this.COMBINED_FLAG_THRESHOLD ? ['content-safety-service flagged'] : [],
      score,
    };
  }

  /**
   * Runs BOTH scorers and returns the higher verdict + the union of reasons.
   * `score === max(hfScore, contentSafetyScore)`, so a homoglyph bypass on
   * the OpenAI adapter still trips the local keyword filter (and vice versa).
   *
   * `sources` lists only the scorers that actually crossed the flag threshold
   * — a near-zero HF score is not a signal worth recording.
   */
  async moderateContent(
    content: string,
  ): Promise<{ flagged: boolean; reasons: string[]; score: number; sources: string[] }> {
    const [hf, safety] = await Promise.all([
      this.analyze(content),
      this.classifyContentSafety(content),
    ]);
    const score = Math.max(hf.score, safety.score);
    const reasons = Array.from(new Set([...hf.reasons, ...safety.reasons]));
    const sources = [
      hf.score > this.COMBINED_FLAG_THRESHOLD && 'huggingface',
      safety.score > this.COMBINED_FLAG_THRESHOLD && 'content-safety',
    ].filter(Boolean) as string[];
    return {
      flagged: score > this.COMBINED_FLAG_THRESHOLD,
      reasons,
      score,
      sources,
    };
  }
}
