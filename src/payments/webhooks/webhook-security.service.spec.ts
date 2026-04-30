import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookSecurityService, WEBHOOK_SECURITY } from './webhook-security.service';

describe('WebhookSecurityService', () => {
  let service: WebhookSecurityService;
  const TEST_SECRET = 'whsec_test_secret_key_for_unit_tests';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSecurityService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_WEBHOOK_SECRET') return TEST_SECRET;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookSecurityService>(WebhookSecurityService);
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function createStripeSignature(payload: string, secret: string, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1_000);
    const signedPayload = `${ts}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    return `t=${ts},v1=${signature}`;
  }

  // ---------------------------------------------------------------------------
  // Stripe signature verification
  // ---------------------------------------------------------------------------

  describe('verifyStripeSignature', () => {
    const payload = JSON.stringify({ id: 'evt_test_123', type: 'payment_intent.succeeded' });

    it('should accept a valid signature', () => {
      const header = createStripeSignature(payload, TEST_SECRET);
      const result = service.verifyStripeSignature(Buffer.from(payload), header);
      expect(result.valid).toBe(true);
    });

    it('should accept a valid signature from a string payload', () => {
      const header = createStripeSignature(payload, TEST_SECRET);
      const result = service.verifyStripeSignature(payload, header);
      expect(result.valid).toBe(true);
    });

    it('should reject a missing signature header', () => {
      const result = service.verifyStripeSignature(Buffer.from(payload), '');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing');
    });

    it('should reject an invalid signature', () => {
      const header = createStripeSignature(payload, 'wrong_secret');
      const result = service.verifyStripeSignature(Buffer.from(payload), header);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Signature verification failed');
    });

    it('should reject a tampered payload', () => {
      const header = createStripeSignature(payload, TEST_SECRET);
      const tampered = JSON.stringify({ id: 'evt_tampered', type: 'charge.refunded' });
      const result = service.verifyStripeSignature(Buffer.from(tampered), header);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Signature verification failed');
    });

    it('should reject a timestamp that is too old', () => {
      const oldTimestamp = Math.floor(Date.now() / 1_000) - 600; // 10 minutes ago
      const header = createStripeSignature(payload, TEST_SECRET, oldTimestamp);
      const result = service.verifyStripeSignature(Buffer.from(payload), header);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too old');
    });

    it('should reject a timestamp from the future', () => {
      const futureTimestamp = Math.floor(Date.now() / 1_000) + 600; // 10 minutes in the future
      const header = createStripeSignature(payload, TEST_SECRET, futureTimestamp);
      const result = service.verifyStripeSignature(Buffer.from(payload), header);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('future');
    });

    it('should accept a timestamp slightly in the future (clock skew tolerance)', () => {
      const slightFuture = Math.floor(Date.now() / 1_000) + 10; // 10 seconds ahead
      const header = createStripeSignature(payload, TEST_SECRET, slightFuture);
      const result = service.verifyStripeSignature(Buffer.from(payload), header);
      expect(result.valid).toBe(true);
    });

    it('should reject a header with missing timestamp', () => {
      const signature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(`123.${payload}`, 'utf8')
        .digest('hex');
      const header = `v1=${signature}`; // no t= field
      const result = service.verifyStripeSignature(Buffer.from(payload), header);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('timestamp');
    });

    it('should reject a header with no v1 signature', () => {
      const ts = Math.floor(Date.now() / 1_000);
      const header = `t=${ts}`;
      const result = service.verifyStripeSignature(Buffer.from(payload), header);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('No v1 signature');
    });
  });

  // ---------------------------------------------------------------------------
  // Generic HMAC verification
  // ---------------------------------------------------------------------------

  describe('verifyHmacSignature', () => {
    const payload = '{"event":"test"}';
    const secret = 'my_webhook_secret';

    function computeHmac(data: string, key: string): string {
      return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
    }

    it('should accept a valid HMAC signature', () => {
      const sig = computeHmac(payload, secret);
      const result = service.verifyHmacSignature(payload, sig, secret);
      expect(result.valid).toBe(true);
    });

    it('should reject an invalid HMAC signature', () => {
      const result = service.verifyHmacSignature(payload, 'invalid_sig', secret);
      expect(result.valid).toBe(false);
    });

    it('should reject a missing signature', () => {
      const result = service.verifyHmacSignature(payload, '', secret);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing');
    });

    it('should reject a missing secret', () => {
      const sig = computeHmac(payload, secret);
      const result = service.verifyHmacSignature(payload, sig, '');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not configured');
    });
  });

  // ---------------------------------------------------------------------------
  // Timestamp validation
  // ---------------------------------------------------------------------------

  describe('validateTimestamp', () => {
    it('should accept a current timestamp', () => {
      const now = Math.floor(Date.now() / 1_000);
      const result = service.validateTimestamp(now);
      expect(result.valid).toBe(true);
    });

    it('should accept a timestamp within the valid window', () => {
      const threeMinutesAgo = Math.floor(Date.now() / 1_000) - 180;
      const result = service.validateTimestamp(threeMinutesAgo);
      expect(result.valid).toBe(true);
    });

    it('should reject a timestamp older than the max age', () => {
      const tenMinutesAgo = Math.floor(Date.now() / 1_000) - 600;
      const result = service.validateTimestamp(tenMinutesAgo);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too old');
    });

    it('should reject a timestamp far in the future', () => {
      const tenMinutesFuture = Math.floor(Date.now() / 1_000) + 600;
      const result = service.validateTimestamp(tenMinutesFuture);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('future');
    });

    it('should reject NaN timestamp', () => {
      const result = service.validateTimestamp(NaN);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid');
    });

    it('should reject zero timestamp', () => {
      const result = service.validateTimestamp(0);
      expect(result.valid).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Replay attack prevention
  // ---------------------------------------------------------------------------

  describe('isReplayAttack', () => {
    it('should return false for a new event ID', () => {
      expect(service.isReplayAttack('evt_unique_001')).toBe(false);
    });

    it('should return true for a duplicate event ID', () => {
      service.isReplayAttack('evt_duplicate_001');
      expect(service.isReplayAttack('evt_duplicate_001')).toBe(true);
    });

    it('should handle multiple unique event IDs', () => {
      expect(service.isReplayAttack('evt_a')).toBe(false);
      expect(service.isReplayAttack('evt_b')).toBe(false);
      expect(service.isReplayAttack('evt_c')).toBe(false);
      // Replays
      expect(service.isReplayAttack('evt_a')).toBe(true);
      expect(service.isReplayAttack('evt_b')).toBe(true);
    });

    it('should return false for empty event ID (skip replay check)', () => {
      expect(service.isReplayAttack('')).toBe(false);
    });

    it('should allow re-processing after clearProcessedEvent', () => {
      service.isReplayAttack('evt_clear_test');
      expect(service.isReplayAttack('evt_clear_test')).toBe(true);

      service.clearProcessedEvent('evt_clear_test');
      expect(service.isReplayAttack('evt_clear_test')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Full Stripe verification pipeline
  // ---------------------------------------------------------------------------

  describe('verifyStripeWebhook', () => {
    const payload = JSON.stringify({ id: 'evt_pipeline_001', type: 'charge.succeeded' });

    it('should accept a fully valid webhook', () => {
      const header = createStripeSignature(payload, TEST_SECRET);
      const result = service.verifyStripeWebhook(Buffer.from(payload), header, 'evt_pipeline_001');
      expect(result.valid).toBe(true);
    });

    it('should reject an invalid signature in the pipeline', () => {
      const header = createStripeSignature(payload, 'wrong');
      const result = service.verifyStripeWebhook(Buffer.from(payload), header, 'evt_pipeline_002');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Signature');
    });

    it('should reject a replay in the pipeline', () => {
      const header = createStripeSignature(payload, TEST_SECRET);
      // First call succeeds
      const first = service.verifyStripeWebhook(Buffer.from(payload), header, 'evt_pipeline_003');
      expect(first.valid).toBe(true);

      // Second call with same event ID is a replay
      const freshHeader = createStripeSignature(payload, TEST_SECRET);
      const second = service.verifyStripeWebhook(
        Buffer.from(payload),
        freshHeader,
        'evt_pipeline_003',
      );
      expect(second.valid).toBe(false);
      expect(second.reason).toContain('Duplicate');
    });

    it('should reject an expired timestamp in the pipeline', () => {
      const oldTs = Math.floor(Date.now() / 1_000) - 600;
      const header = createStripeSignature(payload, TEST_SECRET, oldTs);
      const result = service.verifyStripeWebhook(Buffer.from(payload), header, 'evt_pipeline_004');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too old');
    });
  });
});
