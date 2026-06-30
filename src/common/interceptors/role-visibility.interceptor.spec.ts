import 'reflect-metadata';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { RoleVisibilityInterceptor } from './role-visibility.interceptor';
import { VisibleTo } from '../decorators/visible-to.decorator';
import { UserRole } from '../../users/entities/user.entity';

// ─── Test entity ─────────────────────────────────────────────────────────────

class SensitiveResource {
  id: string = 'r1';
  name: string = 'Public Name';

  @VisibleTo(UserRole.ADMIN)
  secretToken: string = 'tok-secret';

  @VisibleTo(UserRole.ADMIN, UserRole.MODERATOR)
  internalScore: number = 99;
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function buildContext(role?: UserRole | null): ExecutionContext {
  const user = role === null ? undefined : { role: role ?? UserRole.STUDENT };
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function buildHandler(value: unknown): CallHandler {
  return { handle: () => of(value) } as CallHandler;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RoleVisibilityInterceptor', () => {
  let interceptor: RoleVisibilityInterceptor;

  beforeEach(() => {
    interceptor = new RoleVisibilityInterceptor();
  });

  describe('unauthenticated requests', () => {
    it('passes the response through unchanged when there is no user', async () => {
      const resource = new SensitiveResource();
      const result = await lastValueFrom(
        interceptor.intercept(buildContext(null), buildHandler(resource)),
      );
      expect(result).toBe(resource);
    });
  });

  describe('ADMIN role', () => {
    it('returns all fields including @VisibleTo(ADMIN) ones', async () => {
      const resource = new SensitiveResource();
      const result = (await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.ADMIN), buildHandler(resource)),
      )) as Record<string, unknown>;

      expect(result['secretToken']).toBe('tok-secret');
      expect(result['internalScore']).toBe(99);
    });
  });

  describe('STUDENT role', () => {
    it('strips @VisibleTo(ADMIN) fields', async () => {
      const resource = new SensitiveResource();
      const result = (await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.STUDENT), buildHandler(resource)),
      )) as Record<string, unknown>;

      expect('secretToken' in result).toBe(false);
    });

    it('strips @VisibleTo(ADMIN, MODERATOR) fields', async () => {
      const resource = new SensitiveResource();
      const result = (await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.STUDENT), buildHandler(resource)),
      )) as Record<string, unknown>;

      expect('internalScore' in result).toBe(false);
    });

    it('preserves non-annotated public fields', async () => {
      const resource = new SensitiveResource();
      const result = (await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.STUDENT), buildHandler(resource)),
      )) as Record<string, unknown>;

      expect(result['id']).toBe('r1');
      expect(result['name']).toBe('Public Name');
    });
  });

  describe('MODERATOR role', () => {
    it('strips @VisibleTo(ADMIN) fields but keeps @VisibleTo(ADMIN, MODERATOR) fields', async () => {
      const resource = new SensitiveResource();
      const result = (await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.MODERATOR), buildHandler(resource)),
      )) as Record<string, unknown>;

      expect('secretToken' in result).toBe(false);
      expect(result['internalScore']).toBe(99);
    });
  });

  describe('array responses', () => {
    it('strips restricted fields from every element', async () => {
      const resources = [new SensitiveResource(), new SensitiveResource()];
      const results = (await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.STUDENT), buildHandler(resources)),
      )) as Record<string, unknown>[];

      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect('secretToken' in r).toBe(false);
        expect(r['id']).toBe('r1');
      });
    });
  });

  describe('paginated responses', () => {
    it('strips fields from items inside { data: [...] }', async () => {
      const payload = { data: [new SensitiveResource()], total: 1 };
      const result = (await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.STUDENT), buildHandler(payload)),
      )) as { data: Record<string, unknown>[] };

      expect('secretToken' in result.data[0]).toBe(false);
      expect(result.data[0]['id']).toBe('r1');
    });

    it('strips fields from items inside { items: [...] }', async () => {
      const payload = { items: [new SensitiveResource()], total: 1 };
      const result = (await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.STUDENT), buildHandler(payload)),
      )) as { items: Record<string, unknown>[] };

      expect('secretToken' in result.items[0]).toBe(false);
    });
  });

  describe('primitive and null values', () => {
    it('returns primitive values unchanged', async () => {
      const result = await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.STUDENT), buildHandler(42)),
      );
      expect(result).toBe(42);
    });

    it('returns null unchanged', async () => {
      const result = await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.STUDENT), buildHandler(null)),
      );
      expect(result).toBeNull();
    });
  });

  describe('plain objects without @VisibleTo annotations', () => {
    it('returns all fields for plain objects', async () => {
      const plain = { a: 1, b: 2 };
      const result = await lastValueFrom(
        interceptor.intercept(buildContext(UserRole.STUDENT), buildHandler(plain)),
      );
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });
});
