import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ApiVersionMiddleware } from './api-version.middleware';
import { Request, Response } from 'express';

function buildConfigService(overrides: Record<string, string> = {}): jest.Mocked<ConfigService> {
  const defaults: Record<string, string> = {
    SUNSET_VERSIONS: 'v1:2024-01-01',
    DEPRECATED_VERSIONS: 'v2:2025-06-01',
    API_MIGRATION_DOCS_URL: 'https://docs.example.com/migration',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, fallback?: string) => defaults[key] ?? fallback ?? ''),
  } as unknown as jest.Mocked<ConfigService>;
}

function buildRes(): jest.Mocked<Response> {
  const res: Partial<jest.Mocked<Response>> = {
    setHeader: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as jest.Mocked<Response>;
}

describe('ApiVersionMiddleware', () => {
  let middleware: ApiVersionMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiVersionMiddleware, { provide: ConfigService, useValue: buildConfigService() }],
    }).compile();

    middleware = module.get(ApiVersionMiddleware);
  });

  describe('extractVersion', () => {
    it('returns null for non-versioned paths', () => {
      expect(middleware.extractVersion('/users')).toBeNull();
      expect(middleware.extractVersion('/')).toBeNull();
      expect(middleware.extractVersion('/health')).toBeNull();
    });

    it('extracts version from path prefix', () => {
      expect(middleware.extractVersion('/v1/users')).toBe('v1');
      expect(middleware.extractVersion('/v2/courses')).toBe('v2');
      expect(middleware.extractVersion('/V3/items')).toBe('v3');
    });

    it('extracts version from bare version path', () => {
      expect(middleware.extractVersion('/v1')).toBe('v1');
    });
  });

  describe('sunset versions', () => {
    it('returns 410 Gone for a sunset version', () => {
      const req = { path: '/v1/users', method: 'GET' } as Request;
      const res = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 410,
          error: 'Gone',
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('sets Sunset and Link response headers', () => {
      const req = { path: '/v1/courses', method: 'GET' } as Request;
      const res = buildRes();

      middleware.use(req, res, jest.fn());

      expect(res.setHeader).toHaveBeenCalledWith('Sunset', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith(
        'Link',
        expect.stringContaining('successor-version'),
      );
    });
  });

  describe('deprecated versions', () => {
    it('calls next() for deprecated (grace-period) versions', () => {
      const req = { path: '/v2/users', method: 'GET' } as Request;
      const res = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('sets Deprecation and Sunset headers for deprecated versions', () => {
      const req = { path: '/v2/courses', method: 'GET' } as Request;
      const res = buildRes();

      middleware.use(req, res, jest.fn());

      expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
      expect(res.setHeader).toHaveBeenCalledWith('Sunset', expect.any(String));
    });
  });

  describe('non-versioned paths', () => {
    it('passes through without touching response headers', () => {
      const req = { path: '/health', method: 'GET' } as Request;
      const res = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('empty configuration', () => {
    it('passes all requests when no versions are configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ApiVersionMiddleware,
          {
            provide: ConfigService,
            useValue: buildConfigService({ SUNSET_VERSIONS: '', DEPRECATED_VERSIONS: '' }),
          },
        ],
      }).compile();

      const mw = module.get(ApiVersionMiddleware);
      const req = { path: '/v1/users', method: 'GET' } as Request;
      const res = buildRes();
      const next = jest.fn();

      mw.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
