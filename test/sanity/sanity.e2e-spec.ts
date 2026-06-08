import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { TestHttpClient } from '../utils/test-http-client';
import { TestRetryHelper } from '../utils/test-retry-helper';

describe('Sanity test suite', () => {
  let app: INestApplication;
  let httpClient: TestHttpClient;
  let retryHelper: TestRetryHelper;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    httpClient = new TestHttpClient(app.getHttpServer());
    retryHelper = new TestRetryHelper();
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);

  describe('Core App Health', () => {
    it('returns the root health status', async () => {
      await retryHelper.withRetry(
        async () => {
          const response = await httpClient.get('/');

          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('message', 'TeachLink API is running');
          expect(response.body).toHaveProperty('timestamp');
        },
        {
          maxAttempts: 3,
          delayMs: 500,
        },
      );
    }, 10000);
  });

  describe('Search workflows', () => {
    it('returns stable search results for a query', async () => {
      const response = await retryHelper.withRetry(() => httpClient.get('/search?q=javascript'), {
        maxAttempts: 3,
        delayMs: 500,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('query', 'javascript');
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    }, 15000);

    it('accepts valid search filters payload', async () => {
      const filters = encodeURIComponent(
        JSON.stringify({ category: 'programming', level: 'beginner' }),
      );
      const response = await retryHelper.withRetry(
        () => httpClient.get(`/search?q=javascript&filters=${filters}`),
        { maxAttempts: 3, delayMs: 500 },
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('query', 'javascript');
      expect(response.body).toHaveProperty('filters');
      expect(response.body.filters).toMatchObject({ category: 'programming', level: 'beginner' });
    }, 15000);

    it('returns autocomplete suggestions', async () => {
      const response = await retryHelper.withRetry(
        () => httpClient.get('/search/autocomplete?q=java'),
        { maxAttempts: 3, delayMs: 500 },
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    }, 15000);

    it('returns search filters metadata', async () => {
      const response = await httpClient.get('/search/filters');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('levels');
      expect(response.body).toHaveProperty('languages');
    }, 10000);

    it('returns analytics summary for the search service', async () => {
      const response = await httpClient.get('/search/analytics?days=7');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('topQueries');
      expect(Array.isArray(response.body.topQueries)).toBe(true);
      expect(response.body).toHaveProperty('totalSearches', 0);
      expect(response.body).toHaveProperty('averageResults', 0);
    }, 15000);
  });
});
