import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import Redis from 'ioredis';
import { getSharedRedisClient } from '../config/cache.config';

export interface SignedRequestParts {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

const NONCE_REDIS_PREFIX = 'nonce:';

@Injectable()
export class RequestSigningService {
  private readonly logger = new Logger(RequestSigningService.name);
  private readonly redis: Redis;
  private readonly freshnessWindowMs: number;

  constructor(@Optional() configService?: ConfigService) {
    this.redis = getSharedRedisClient(configService);
    this.freshnessWindowMs =
      configService?.get<number>('REQUEST_SIGNING_FRESHNESS_MS', 300_000) ?? 300_000;
  }

  /**
   * Generates an HMAC-SHA256 signature for the given payload.
   * @param secret  Shared secret key.
   * @param payload String to sign (e.g. method + path + timestamp + body).
   */
  sign(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verifies that the provided signature matches the expected one.
   * Uses timing-safe comparison to prevent timing attacks.
   */
  verify(secret: string, payload: string, signature: string): boolean {
    const expected = this.sign(secret, payload);
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }

  /** Builds the canonical payload string from request parts. */
  buildPayload(method: string, path: string, timestamp: string, body: string): string {
    return `${method.toUpperCase()}:${path}:${timestamp}:${body}`;
  }

  /**
   * Builds a canonical payload that includes a nonce for replay protection.
   */
  buildPayloadWithNonce(parts: SignedRequestParts): string {
    const { method, path, timestamp, nonce, body } = parts;
    return `${method.toUpperCase()}:${path}:${timestamp}:${nonce}:${body}`;
  }

  /**
   * Signs a request with a nonce embedded in the payload.
   */
  signWithNonce(secret: string, parts: SignedRequestParts): string {
    return this.sign(secret, this.buildPayloadWithNonce(parts));
  }

  /**
   * Full verification pipeline:
   *  1. Checks timestamp is within the configurable freshness window.
   *  2. Checks the nonce has not been reused (via Redis SET NX with TTL).
   *  3. Verifies the HMAC signature with a constant-time comparison.
   *
   * Returns a VerificationResult — never throws.
   */
  async verifySignedRequest(
    secret: string,
    parts: SignedRequestParts,
    signature: string,
  ): Promise<VerificationResult> {
    // 1. Timestamp freshness check
    const now = Date.now();
    const requestTime = parseInt(parts.timestamp, 10);
    if (isNaN(requestTime)) {
      return { valid: false, reason: 'invalid_timestamp' };
    }
    const age = Math.abs(now - requestTime);
    if (age > this.freshnessWindowMs) {
      return { valid: false, reason: 'timestamp_expired' };
    }

    // 2. Nonce replay check
    const nonceKey = `${NONCE_REDIS_PREFIX}${parts.nonce}`;
    const nonceStored = await this.redis.set(nonceKey, '1', 'PX', this.freshnessWindowMs, 'NX');
    if (nonceStored !== 'OK') {
      return { valid: false, reason: 'nonce_reused' };
    }

    // 3. Constant-time HMAC verification
    const payload = this.buildPayloadWithNonce(parts);
    if (!this.verify(secret, payload, signature)) {
      return { valid: false, reason: 'signature_mismatch' };
    }

    return { valid: true };
  }
}
