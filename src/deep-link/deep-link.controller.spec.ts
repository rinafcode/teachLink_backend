import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { deepLinkRateLimitConfig } from './deep-link.config';
import { DeepLinkModule } from './deep-link.module';

describe('DeepLinkController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DeepLinkModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows normal redirects', async () => {
    await request(app.getHttpServer())
      .get('/deep-link/course/course-123')
      .expect(302)
      .expect('Location', '/course/course-123');
  });

  it('returns 429 with a clear message after the redirect limit', async () => {
    let lastResponse: request.Response | undefined;

    for (let attempt = 0; attempt <= deepLinkRateLimitConfig.redirectLimit; attempt += 1) {
      lastResponse = await request(app.getHttpServer()).get('/deep-link/course/course-123');
    }

    expect(lastResponse?.status).toBe(429);
    expect(
      String(lastResponse?.body?.message ?? lastResponse?.text),
    ).toMatch(/too many requests/i);
  });
});
