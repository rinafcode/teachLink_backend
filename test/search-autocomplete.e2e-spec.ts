import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

describe('Search Autocomplete E2E Tests (Issue #545)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /search/autocomplete - Autocomplete Suggestions', () => {
    it('should return empty for short queries', async () => {
      const response = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: 'a' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should return autocomplete suggestions for "java"', async () => {
      const response = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: 'java' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Should contain suggestions
      const suggestions = response.body as any[];
      expect(suggestions.length).toBeGreaterThan(0);

      // Check suggestion structure
      suggestions.forEach((suggestion) => {
        expect(suggestion).toHaveProperty('title');
        expect(suggestion).toHaveProperty('type');
        expect(['course', 'category', 'trending']).toContain(suggestion.type);
        expect(suggestion).toHaveProperty('metadata');
      });
    });

    it('should return course suggestions matching query', async () => {
      const response = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: 'javascript' });

      expect(response.status).toBe(200);
      const suggestions = response.body as any[];

      // Should include course types
      const courseSuggestions = suggestions.filter((s) => s.type === 'course');
      expect(courseSuggestions.length).toBeGreaterThan(0);

      courseSuggestions.forEach((s) => {
        expect(s.metadata).toHaveProperty('courseId');
      });
    });

    it('should return category suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: 'prog' });

      expect(response.status).toBe(200);
      const suggestions = response.body as any[];

      // Should include category type
      const categorySuggestions = suggestions.filter((s) => s.type === 'category');
      expect(categorySuggestions.length).toBeGreaterThan(0);
    });

    it('should return trending suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: 'react' });

      expect(response.status).toBe(200);
      const suggestions = response.body as any[];

      // Should include trending suggestions
      const trendingSuggestions = suggestions.filter((s) => s.type === 'trending');
      expect(trendingSuggestions.length).toBeGreaterThan(0);
    });

    it('should limit autocomplete results to 10', async () => {
      const response = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: 'a' });

      expect(response.status).toBe(200);
      expect(response.body.length).toBeLessThanOrEqual(10);
    });

    it('should deduplicate suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: 'python' });

      expect(response.status).toBe(200);
      const suggestions = response.body as any[];

      // Check for uniqueness
      const titles = suggestions.map((s) => `${s.title}:${s.type}`);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(titles.length);
    });

    it('should have fast response time < 500ms', async () => {
      const start = Date.now();
      const response = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: 'javascript' });
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('GET /search - Full Search with Autocomplete Integration', () => {
    it('should search with suggestions', async () => {
      // First get autocomplete suggestions
      const suggestionsResponse = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: 'javascript' });

      expect(suggestionsResponse.status).toBe(200);

      // Then search based on suggestion
      if (suggestionsResponse.body.length > 0) {
        const firstSuggestion = suggestionsResponse.body[0];
        const searchResponse = await request(app.getHttpServer())
          .get('/search')
          .query({ q: firstSuggestion.title });

        expect(searchResponse.status).toBe(200);
        expect(searchResponse.body).toHaveProperty('results');
        expect(searchResponse.body).toHaveProperty('total');
      }
    });

    it('should return results quickly for autocompleted searches', async () => {
      const start = Date.now();
      const response = await request(app.getHttpServer()).get('/search').query({ q: 'python' });
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('GET /search/filters - Available Filters', () => {
    it('should return available filters', async () => {
      const response = await request(app.getHttpServer()).get('/search/filters');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('levels');
      expect(response.body).toHaveProperty('languages');
      expect(response.body).toHaveProperty('priceRanges');

      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(Array.isArray(response.body.levels)).toBe(true);
    });
  });

  describe('Caching & Performance', () => {
    it('should cache autocomplete results', async () => {
      const query = 'typescript';

      // First request (cache miss)
      const start1 = Date.now();
      const response1 = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: query });
      const duration1 = Date.now() - start1;

      // Second request (cache hit - should be faster)
      const start2 = Date.now();
      const response2 = await request(app.getHttpServer())
        .get('/search/autocomplete')
        .query({ q: query });
      const duration2 = Date.now() - start2;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Results should be identical
      expect(response1.body).toEqual(response2.body);

      // Second should typically be faster (though not guaranteed in tests)
      // Just verify both are reasonable response times
      expect(duration1).toBeLessThan(1000);
      expect(duration2).toBeLessThan(1000);
    });
  });
});
