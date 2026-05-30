import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class RequestSigningService {
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
}