import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { EventType } from '../../../analytics/entities/event.entity';

describe('Event Tracking E2E Tests (Issue #546)', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // TODO: Setup test user and get auth token
    // This is a placeholder
    authToken = 'test-token';
    userId = 'test-user-id';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /analytics/events - Track Events', () => {
    it('should track a signup event', async () => {
      const response = await request(app.getHttpServer())
        .post('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: EventType.SIGNUP,
          category: 'user',
          action: 'signup',
          properties: { source: 'organic', referrer: 'google' },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should track a login event', async () => {
      const response = await request(app.getHttpServer())
        .post('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: EventType.LOGIN,
          category: 'user',
          action: 'login',
          properties: { method: 'email' },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should track a course view event', async () => {
      const response = await request(app.getHttpServer())
        .post('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: EventType.COURSE_VIEW,
          category: 'course',
          action: 'view',
          label: 'course-123',
          properties: { courseId: 'course-123', courseTitle: 'JavaScript Basics' },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should track a purchase event with amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: EventType.PURCHASE,
          category: 'purchase',
          action: 'course_purchase',
          value: 49.99,
          label: 'course-123',
          properties: { courseId: 'course-123', planId: 'pro' },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid event without required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          category: 'user',
          // Missing eventType, action
        });

      expect(response.status).toBe(400);
    });

    it('should track custom events', async () => {
      const response = await request(app.getHttpServer())
        .post('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: EventType.CUSTOM,
          category: 'engagement',
          action: 'button_click',
          properties: { buttonId: 'hero-cta', page: 'homepage' },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /analytics/events - Query Events', () => {
    it('should retrieve events with filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          eventType: 'purchase',
          category: 'purchase',
          limit: 50,
          offset: 0,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('total');
    });

    it('should retrieve events by date range', async () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const response = await request(app.getHttpServer())
        .get('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: sevenDaysAgo.toISOString(),
          endDate: now.toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('events');
    });
  });

  describe('GET /analytics/summary - Analytics Summary', () => {
    it('should return analytics summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/summary')
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalEvents');
      expect(response.body).toHaveProperty('eventsByType');
      expect(response.body).toHaveProperty('eventsByCategory');
      expect(response.body).toHaveProperty('topActions');
    });
  });

  describe('Event Batching', () => {
    it('should batch multiple events and flush them', async () => {
      // Track multiple events
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/analytics/events')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            eventType: EventType.CUSTOM,
            category: 'test',
            action: `action_${i}`,
          });
      }

      // Wait for batch flush interval
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Verify events were persisted
      const response = await request(app.getHttpServer())
        .get('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ category: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.total).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Event Validation', () => {
    it('should validate purchase events have amount', async () => {
      const response = await request(app.getHttpServer())
        .post('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: EventType.PURCHASE,
          category: 'purchase',
          action: 'purchase',
          // Missing required value field
        });

      expect(response.status).toBe(400);
    });

    it('should validate course view events have courseId', async () => {
      const response = await request(app.getHttpServer())
        .post('/analytics/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: EventType.COURSE_VIEW,
          category: 'course',
          action: 'view',
          // Missing courseId in properties
        });

      expect(response.status).toBe(400);
    });
  });
});
