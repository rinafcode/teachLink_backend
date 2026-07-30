import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { TestHttpClient } from './utils/test-http-client';

/**
 * E2E tests for Permissions endpoints — Issue #967
 *
 * Verifies that authentication and authorization guards are active on all
 * permission mutation endpoints. The 409 deletion-conflict path is covered
 * in the unit tests (permissions.service.spec.ts) because it requires
 * seeded role-permission relationships.
 */
describe('Permissions (e2e)', () => {
  let app: INestApplication;
  let httpClient: TestHttpClient;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    httpClient = new TestHttpClient(app.getHttpServer());
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30000);

  // ── 401: Anonymous / unauthenticated access ──────────────────────────────

  describe('POST /permissions — unauthenticated', () => {
    it('should return 401 when no auth token is provided', async () => {
      const response = await httpClient.post('/permissions', {
        resource: 'test',
        action: 'read',
      });
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /permissions/:id — unauthenticated', () => {
    it('should return 401 when no auth token is provided', async () => {
      const response = await httpClient.put('/permissions/fake-id', {
        resource: 'test',
        action: 'write',
      });
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /permissions/:id — unauthenticated', () => {
    it('should return 401 when no auth token is provided', async () => {
      const response = await httpClient.delete('/permissions/fake-id');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /permissions — unauthenticated', () => {
    it('should return 401 when no auth token is provided (class-level guard)', async () => {
      const response = await httpClient.get('/permissions');
      expect(response.status).toBe(401);
    });
  });

  // ── Guard chain verified with malformed tokens ───────────────────────────

  describe('POST /permissions — guarded against invalid tokens', () => {
    it('should reject a malformed token', async () => {
      const response = await httpClient.post(
        '/permissions',
        {
          resource: 'test',
          action: 'read',
        },
        {
          auth: { token: 'invalid-token' },
        },
      );
      // JWT guard rejects malformed tokens; the guard chain is verified active
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('PUT /permissions/:id — guarded against invalid tokens', () => {
    it('should reject a malformed token', async () => {
      const response = await httpClient.put(
        '/permissions/fake-id',
        {
          resource: 'test',
          action: 'write',
        },
        {
          auth: { token: 'invalid-token' },
        },
      );
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('DELETE /permissions/:id — guarded against invalid tokens', () => {
    it('should reject a malformed token', async () => {
      const response = await httpClient.delete('/permissions/fake-id', {
        auth: { token: 'invalid-token' },
      });
      expect([401, 403]).toContain(response.status);
    });
  });

  // ── Deletion guard presence ──────────────────────────────────────────────

  describe('DELETE /permissions/:id — deletion guard active', () => {
    it('should return 401 for anonymous access (guards active on DELETE)', async () => {
      const response = await httpClient.delete('/permissions/non-existent-id');
      expect(response.status).toBe(401);
    });

    it('should consistently return 401 for anonymous DELETE requests', async () => {
      // Verify consistency — guards are the same on every call
      const response = await httpClient.delete('/permissions/some-uuid-here');
      expect(response.status).toBe(401);
    });
  });

  // ── Validation pipeline active ──────────────────────────────────────────

  describe('POST /permissions — validation', () => {
    it('should reject request with missing fields when unauthenticated', async () => {
      // Guard catches first (401); validates the endpoint exists and is wired up
      const response = await httpClient.post('/permissions', {});
      expect(response.status).toBe(401);
    });
  });
});
