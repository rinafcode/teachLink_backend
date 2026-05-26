import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { TIME } from '../../common/constants/time.constants';

/**
 * Constants for webhook security configuration
 */
export const WEBHOOK_SECURITY = {
  /** Maximum age (in ms) for a webhook timestamp to be considered valid */
  MAX_TIMESTAMP_AGE_MS: TIME.FIVE_MINUTES_SECONDS * 1_000, // 5 minutes
  /** Hash algorithm used for HMAC signature computation */
  HASH_ALGORITHM: 'sha256',
  /** Prefix for Stripe signature scheme */
  STRIPE_SIGNATURE_SCHEME: 'v1',
  /** Maximum number of processed event IDs to keep in memory for replay prevention */
  MAX_PROCESSED_EVENTS_SIZE: 10_000,
  /** TTL for processed event IDs in ms (24 hours) */
  PROCESSED_EVENTS_TTL_MS: TIME.ONE_HOUR_MS * 24,
} as const;

export interface IWebhookVerificationResult {
  valid: boolean;
  reason?: string;
}

@Injectable()
export class WebhookSecurityService {
  private readonly logger = new Logger(WebhookSecurityService.name);

  /**
   * In-memory store for processed webhook event IDs.
   * Key: eventId, Value: timestamp when the event was processed.
   *
   * In production at scale, this should be replaced with Redis
   * to share state across multiple instances.
   */
  private readonly processedEvents = new Map<string, number>();

  private readonly stripeWebhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.stripeWebhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
  }

  // ---------------------------------------------------------------------------
  // Stripe-specific verification
  // ---------------------------------------------------------------------------

  /**
   * Verify a Stripe webhook signature using the `stripe-signature` header.
   *
   * Stripe signs webhooks with a scheme:
   *   `t=<timestamp>,v1=<signature>`
   *
   * We parse the header, validate the timestamp freshness, compute the
   * expected HMAC-SHA256 signature, and compare using a timing-safe check.
   */
  verifyStripeSignature(
    payload: Buffer | string,
    signatureHeader: string,
  ): IWebhookVerificationResult {
    if (!signatureHeader) {
      return { valid: false, reason: 'Missing stripe-signature header' };
    }

    if (!this.stripeWebhookSecret) {
      this.logger.error(
        'STRIPE_WEBHOOK_SECRET is not configured – cannot verify webhook signatures',
      );
      return { valid: false, reason: 'Webhook secret not configured' };
    }

    // ---- Parse the header ----
    const elements = signatureHeader.split(',');
    const signatureMap: Record<string, string[]> = {};

    for (const element of elements) {
      const [key, value] = element.split('=', 2);
      if (!key || !value) continue;
      if (!signatureMap[key]) {
        signatureMap[key] = [];
      }
      signatureMap[key].push(value);
    }

    const timestampStr = signatureMap['t']?.[0];
    const signatures = signatureMap[WEBHOOK_SECURITY.STRIPE_SIGNATURE_SCHEME] || [];

    if (!timestampStr) {
      return { valid: false, reason: 'Missing timestamp in stripe-signature header' };
    }

    if (signatures.length === 0) {
      return {
        valid: false,
        reason: `No ${WEBHOOK_SECURITY.STRIPE_SIGNATURE_SCHEME} signature found in header`,
      };
    }

    // ---- Timestamp validation ----
    const timestamp = parseInt(timestampStr, 10);
    const timestampResult = this.validateTimestamp(timestamp);
    if (!timestampResult.valid) {
      return timestampResult;
    }

    // ---- Compute expected signature ----
    const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');
    const signedPayload = `${timestampStr}.${payloadString}`;

    const expectedSignature = crypto
      .createHmac(WEBHOOK_SECURITY.HASH_ALGORITHM, this.stripeWebhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    // ---- Timing-safe comparison ----
    const isValid = signatures.some((sig) => this.timingSafeEqual(sig, expectedSignature));

    if (!isValid) {
      this.logger.warn('Stripe webhook signature mismatch');
      return { valid: false, reason: 'Signature verification failed' };
    }

    return { valid: true };
  }

  // ---------------------------------------------------------------------------
  // Generic HMAC verification (for custom / non-Stripe webhooks)
  // ---------------------------------------------------------------------------

  /**
   * Verify a generic HMAC-SHA256 webhook signature.
   *
   * @param payload  Raw request body
   * @param signature  The signature sent in a header by the caller
   * @param secret  The shared secret for HMAC computation
   */
  verifyHmacSignature(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): IWebhookVerificationResult {
    if (!signature) {
      return { valid: false, reason: 'Missing webhook signature' };
    }

    if (!secret) {
      return { valid: false, reason: 'Webhook secret not configured' };
    }

    const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');

    const expectedSignature = crypto
      .createHmac(WEBHOOK_SECURITY.HASH_ALGORITHM, secret)
      .update(payloadString, 'utf8')
      .digest('hex');

    if (!this.timingSafeEqual(signature, expectedSignature)) {
      this.logger.warn('HMAC webhook signature mismatch');
      return { valid: false, reason: 'Signature verification failed' };
    }

    return { valid: true };
  }

  // ---------------------------------------------------------------------------
  // Timestamp validation
  // ---------------------------------------------------------------------------

  /**
   * Validate that a webhook timestamp is within the acceptable window.
   *
   * @param timestamp  Unix timestamp in **seconds** (Stripe convention)
   */
  validateTimestamp(timestamp: number): IWebhookVerificationResult {
    if (!timestamp || isNaN(timestamp)) {
      return { valid: false, reason: 'Invalid or missing timestamp' };
    }

    const timestampMs = timestamp * 1_000;
    const now = Date.now();
    const age = now - timestampMs;

    // Reject timestamps from the future (with a small tolerance for clock skew)
    if (age < -TIME.THIRTY_SECONDS_MS) {
      this.logger.warn(
        `Webhook timestamp is in the future: ${new Date(timestampMs).toISOString()}`,
      );
      return { valid: false, reason: 'Webhook timestamp is in the future' };
    }

    // Reject timestamps that are too old
    if (age > WEBHOOK_SECURITY.MAX_TIMESTAMP_AGE_MS) {
      this.logger.warn(
        `Webhook timestamp too old: ${age}ms (max ${WEBHOOK_SECURITY.MAX_TIMESTAMP_AGE_MS}ms)`,
      );
      return {
        valid: false,
        reason: `Webhook timestamp is too old (${Math.round(age / 1_000)}s > ${WEBHOOK_SECURITY.MAX_TIMESTAMP_AGE_MS / 1_000}s)`,
      };
    }

    return { valid: true };
  }

  // ---------------------------------------------------------------------------
  // Replay attack prevention
  // ---------------------------------------------------------------------------

  /**
   * Check if a webhook event ID has already been processed (replay attack).
   * If not, mark it as processed.
   *
   * @returns `true` if the event is a replay (already seen), `false` otherwise
   */
  isReplayAttack(eventId: string): boolean {
    if (!eventId) {
      this.logger.warn('Empty event ID – cannot perform replay check');
      return false; // Let other guards handle missing IDs
    }

    // Periodically evict stale entries
    this.evictStaleEntries();

    if (this.processedEvents.has(eventId)) {
      this.logger.warn(`Replay attack detected: event ${eventId} already processed`);
      return true;
    }

    this.processedEvents.set(eventId, Date.now());
    return false;
  }

  /**
   * Clear a specific event ID from the replay cache.
   * Useful when a webhook fails and should be retried.
   */
  clearProcessedEvent(eventId: string): void {
    this.processedEvents.delete(eventId);
  }

  // ---------------------------------------------------------------------------
  // Full verification pipeline
  // ---------------------------------------------------------------------------

  /**
   * Run the complete Stripe webhook verification pipeline:
   *   1. Signature verification
   *   2. Timestamp validation (embedded in signature check)
   *   3. Replay attack prevention
   */
  verifyStripeWebhook(
    payload: Buffer | string,
    signatureHeader: string,
    eventId: string,
  ): IWebhookVerificationResult {
    // Step 1 & 2: Verify signature (includes timestamp validation)
    const signatureResult = this.verifyStripeSignature(payload, signatureHeader);
    if (!signatureResult.valid) {
      return signatureResult;
    }

    // Step 3: Replay attack prevention
    if (this.isReplayAttack(eventId)) {
      return { valid: false, reason: `Duplicate event: ${eventId}` };
    }

    return { valid: true };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Timing-safe string comparison to prevent timing attacks.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // Still do a comparison to keep constant-ish time, but return false
      const bufA = Buffer.from(a, 'utf8');
      const bufB = Buffer.from(a, 'utf8'); // intentionally same length
      crypto.timingSafeEqual(bufA, bufB);
      return false;
    }

    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Evict stale entries from the in-memory replay cache to prevent
   * unbounded memory growth.
   */
  private evictStaleEntries(): void {
    if (this.processedEvents.size <= WEBHOOK_SECURITY.MAX_PROCESSED_EVENTS_SIZE) {
      return;
    }

    const now = Date.now();
    for (const [eventId, timestamp] of this.processedEvents.entries()) {
      if (now - timestamp > WEBHOOK_SECURITY.PROCESSED_EVENTS_TTL_MS) {
        this.processedEvents.delete(eventId);
      }
    }

    // If still too large after TTL eviction, drop oldest entries
    if (this.processedEvents.size > WEBHOOK_SECURITY.MAX_PROCESSED_EVENTS_SIZE) {
      const entries = Array.from(this.processedEvents.entries()).sort((a, b) => a[1] - b[1]);
      const toRemove = entries.length - WEBHOOK_SECURITY.MAX_PROCESSED_EVENTS_SIZE;
      for (let i = 0; i < toRemove; i++) {
        this.processedEvents.delete(entries[i][0]);
      }
    }
  }
}
