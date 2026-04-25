import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { PaymentsModule } from '../payments.module';
import {
  WebhookRetry,
  WebhookStatus,
  WebhookProvider,
} from '../webhooks/entities/webhook-retry.entity';

/**
 * Integration Tests for Webhook Retry System
 *
 * These tests demonstrate how to test the webhook retry functionality
 * in an integrated environment. Run with:
 *
 * npm test -- webhook-retry.e2e-spec
 */

describe('Webhook Retry System (e2e)', () => {
  let app: INestApplication;
  let webhookRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DATABASE_HOST || 'localhost',
          port: parseInt(process.env.DATABASE_PORT || '5432'),
          username: process.env.DATABASE_USER || 'postgres',
          password: process.env.DATABASE_PASSWORD || 'postgres',
          database: process.env.DATABASE_NAME || 'teachlink_test',
          entities: [WebhookRetry],
          synchronize: true,
          dropSchema: true,
        }),
        BullModule.forRoot({
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
        }),
        PaymentsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    webhookRepository = moduleFixture.get('WebhookRetryRepository');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /webhooks/stripe', () => {
    it('should queue a Stripe webhook and return retry ID', async () => {
      const payload = JSON.stringify({
        type: 'payment_intent.succeeded',
        id: 'evt_1234567890',
        data: {
          object: {
            id: 'pi_123456',
            metadata: {},
          },
        },
      });

      const response = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send(payload)
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(response.body.webhookRetryId).toBeDefined();

      // Verify webhook was created in database
      const webhook = await webhookRepository.findOne({
        where: { id: response.body.webhookRetryId },
      });

      expect(webhook).toBeDefined();
      expect(webhook.provider).toBe(WebhookProvider.STRIPE);
      expect(webhook.status).toBe(WebhookStatus.PENDING);
      expect(webhook.retryCount).toBe(0);
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = JSON.stringify({
        type: 'payment_intent.succeeded',
        id: 'evt_9876543210',
        data: {
          object: {
            id: 'pi_789012',
            metadata: {},
          },
        },
      });

      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid-signature')
        .send(payload)
        .expect(400);
    });
  });

  describe('POST /webhooks/paypal', () => {
    it('should queue a PayPal webhook and return retry ID', async () => {
      const payload = {
        event_type: 'PAYMENT.SALE.COMPLETED',
        resource: {
          id: 'sale_123456',
          parent_payment: 'payment_123456',
          amount: 100.0,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/webhooks/paypal')
        .set('paypal-transmission-id', 'trans_123')
        .set('paypal-transmission-time', new Date().toISOString())
        .set('paypal-transmission-sig', 'sig_123')
        .set('paypal-cert-url', 'https://example.com/cert.pem')
        .set('paypal-auth-algo', 'SHA256withRSA')
        .send(payload)
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(response.body.webhookRetryId).toBeDefined();
    });
  });

  describe('GET /webhooks/status/:id', () => {
    it('should return webhook status', async () => {
      const webhook = new WebhookRetry();
      webhook.provider = WebhookProvider.STRIPE;
      webhook.externalEventId = 'evt_status_test';
      webhook.status = WebhookStatus.SUCCEEDED;
      webhook.retryCount = 0;

      const saved = await webhookRepository.save(webhook);

      const response = await request(app.getHttpServer())
        .get(`/webhooks/status/${saved.id}`)
        .expect(200);

      expect(response.body.id).toBe(saved.id);
      expect(response.body.status).toBe(WebhookStatus.SUCCEEDED);
    });
  });

  describe('GET /webhooks/dead-letter', () => {
    it('should return dead letter webhooks', async () => {
      // Create a dead letter webhook
      const webhook = new WebhookRetry();
      webhook.provider = WebhookProvider.STRIPE;
      webhook.externalEventId = 'evt_dead_letter_test';
      webhook.status = WebhookStatus.DEAD_LETTER;
      webhook.retryCount = 3;
      webhook.lastError = 'Network timeout';

      await webhookRepository.save(webhook);

      const response = await request(app.getHttpServer()).get('/webhooks/dead-letter').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].status).toBe(WebhookStatus.DEAD_LETTER);
    });
  });

  describe('POST /webhooks/requeue/:id', () => {
    it('should requeue a dead letter webhook', async () => {
      // Create a dead letter webhook
      const webhook = new WebhookRetry();
      webhook.provider = WebhookProvider.STRIPE;
      webhook.externalEventId = 'evt_requeue_test';
      webhook.status = WebhookStatus.DEAD_LETTER;
      webhook.retryCount = 3;
      webhook.payload = {};

      const saved = await webhookRepository.save(webhook);

      const response = await request(app.getHttpServer())
        .post(`/webhooks/requeue/${saved.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify webhook status was updated
      const updated = await webhookRepository.findOne({
        where: { id: saved.id },
      });

      expect(updated.status).toBe(WebhookStatus.PENDING);
      expect(updated.retryCount).toBe(0);
    });
  });

  describe('Webhook Idempotency', () => {
    it('should not create duplicate webhooks for the same event', async () => {
      const payload = JSON.stringify({
        type: 'payment_intent.succeeded',
        id: 'evt_idempotency_test',
        data: {
          object: {
            id: 'pi_idempotency',
            metadata: {},
          },
        },
      });

      // Send the same webhook twice
      const response1 = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send(payload)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send(payload)
        .expect(200);

      // Both should return the same webhook ID (update existing)
      expect(response1.body.webhookRetryId).toBe(response2.body.webhookRetryId);

      // Verify only one webhook was created
      const count = await webhookRepository.count({
        where: {
          provider: WebhookProvider.STRIPE,
          externalEventId: 'evt_idempotency_test',
        },
      });

      expect(count).toBe(1);
    });
  });
});
