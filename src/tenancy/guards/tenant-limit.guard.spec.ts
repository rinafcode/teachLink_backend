import { HttpException, HttpStatus } from '@nestjs/common';
import { TenantLimitGuard, LIMIT_TYPE_KEY } from './tenant-limit.guard';
import { Tenant } from '../entities/tenant.entity';

describe('TenantLimitGuard', () => {
  let guard: TenantLimitGuard;
  let mockTenancyService: any;
  let mockTenant: Partial<Tenant>;

  const createMockContext = (overrides: any = {}) => {
    const handler = jest.fn();
    const request: any = {
      headers: { 'x-tenant-id': 'tenant-1' },
      hostname: 'example.com',
      ...overrides.request,
    };

    if (overrides.limitType) {
      Reflect.defineMetadata(LIMIT_TYPE_KEY, overrides.limitType, handler);
    }

    return {
      getHandler: jest.fn(() => handler),
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => request),
      })),
      getType: jest.fn(() => 'http'),
    } as any;
  };

  beforeEach(() => {
    mockTenant = {
      id: 'tenant-1',
      userLimit: 10,
      storageLimit: 1024,
      currentUserCount: 5,
      currentStorageUsage: 512,
    };

    mockTenancyService = {
      resolveTenantIdFromRequest: jest.fn().mockResolvedValue('tenant-1'),
      findOne: jest.fn().mockResolvedValue(mockTenant),
    };

    guard = new TenantLimitGuard(mockTenancyService);
  });

  describe('no limit type set', () => {
    it('passes when no limit_type metadata is present', async () => {
      await expect(guard.canActivate(createMockContext())).resolves.toBe(true);
    });
  });

  describe('user limit enforcement', () => {
    it('allows user creation when under the limit', async () => {
      mockTenant.currentUserCount = 5;
      mockTenant.userLimit = 10;

      const ctx = createMockContext({ limitType: 'user' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('allows user creation when exactly one below the limit (boundary)', async () => {
      mockTenant.currentUserCount = 9;
      mockTenant.userLimit = 10;

      const ctx = createMockContext({ limitType: 'user' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('returns 402 when current user count equals the limit', async () => {
      mockTenant.currentUserCount = 10;
      mockTenant.userLimit = 10;

      const ctx = createMockContext({ limitType: 'user' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        new HttpException(
          { message: 'User limit exceeded', error: 'Payment Required', statusCode: 402 },
          HttpStatus.PAYMENT_REQUIRED,
        ),
      );
    });

    it('returns 402 when current user count exceeds the limit', async () => {
      mockTenant.currentUserCount = 11;
      mockTenant.userLimit = 10;

      const ctx = createMockContext({ limitType: 'user' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        new HttpException(
          { message: 'User limit exceeded', error: 'Payment Required', statusCode: 402 },
          HttpStatus.PAYMENT_REQUIRED,
        ),
      );
    });

    it('allows unlimited user creation when userLimit is -1', async () => {
      mockTenant.userLimit = -1;
      mockTenant.currentUserCount = 999;

      const ctx = createMockContext({ limitType: 'user' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('storage limit enforcement', () => {
    it('allows upload when under the storage limit', async () => {
      mockTenant.currentStorageUsage = 500;
      mockTenant.storageLimit = 1024;

      const ctx = createMockContext({
        limitType: 'storage',
        request: {
          file: { size: 100 * 1024 * 1024 },
        },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('allows upload when exactly at the storage limit', async () => {
      mockTenant.currentStorageUsage = 924;
      mockTenant.storageLimit = 1024;

      const ctx = createMockContext({
        limitType: 'storage',
        request: {
          file: { size: 100 * 1024 * 1024 },
        },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('returns 402 when upload would exceed the storage limit', async () => {
      mockTenant.currentStorageUsage = 925;
      mockTenant.storageLimit = 1024;

      const ctx = createMockContext({
        limitType: 'storage',
        request: {
          file: { size: 100 * 1024 * 1024 },
        },
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        new HttpException(
          { message: 'Storage limit exceeded', error: 'Payment Required', statusCode: 402 },
          HttpStatus.PAYMENT_REQUIRED,
        ),
      );
    });

    it('passes when no file is present (let the handler validate)', async () => {
      const ctx = createMockContext({ limitType: 'storage', request: {} });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('allows unlimited storage when storageLimit is -1', async () => {
      mockTenant.storageLimit = -1;
      mockTenant.currentStorageUsage = 999999;

      const ctx = createMockContext({
        limitType: 'storage',
        request: {
          file: { size: 500 * 1024 * 1024 },
        },
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });
});
