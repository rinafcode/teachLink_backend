import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Payments e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/payments (POST) creates a payment', async () => {
    const res = await request(app.getHttpServer())
      .post('/payments')
      .send({ userId: 'u1', amount: 10, currency: 'usd', paymentMethod: 'STRIPE' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
  });

  it('/payments/:id/confirm (POST) confirms a payment', async () => {
    // This test assumes a payment with id 'p1' and intent 'pi_123' exists
    await request(app.getHttpServer())
      .post('/payments/p1/confirm')
      .send({ paymentIntentId: 'pi_123' })
      .expect(200);
  });

  it('/payments/webhooks/stripe (POST) handles Stripe webhook', async () => {
    await request(app.getHttpServer())
      .post('/payments/webhooks/stripe')
      .set('stripe-signature', 'test')
      .send({})
      .expect(200);
  });
}); 