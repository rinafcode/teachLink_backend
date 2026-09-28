import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QuotaGuard } from './quota.guard';
import { QuotaTrackingService } from '../services/quota-tracking.service';
import { UserTier } from '../rate-limiting.constants';
import { RateLimitExceededException } from '../../common/exceptions/app.exceptions';

// Mock QuotaTrackingService
class MockQuotaTrackingService {
  checkAndIncrement = jest.fn().mockResolvedValue({
    allowed: true,
    remaining: { minute: 5, hour: 50, day: 200 },
    limit: { minute: 10, hour: 100, day: 500 },
  });
}

describe('QuotaGuard', () => {
  let guard: QuotaGuard;
  let trackingService: QuotaTrackingService;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaGuard,
        { provide: QuotaTrackingService, useClass: MockQuotaTrackingService },
        Reflector,
      ],
    }).compile();

    guard = module.get<QuotaGuard>(QuotaGuard);
    trackingService = module.get<QuotaTrackingService>(QuotaTrackingService);
    reflector = module.get<Reflector>(Reflector);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should use user:{id} as identifier for authenticated requests with req.user.id', async () => {
    // Create mock execution context
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user123', tier: 'FREE' },
          ip: '192.168.1.1',
          headers: {},
        }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    // Mock reflector to return no quota options
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(trackingService.checkAndIncrement).toHaveBeenCalledWith('user:user123', UserTier.FREE);
  });

  it('should use user:{sub} as identifier for authenticated requests with req.user.sub', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 'auth0|user456', tier: 'PRO' },
          ip: '192.168.1.1',
          headers: {},
        }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(trackingService.checkAndIncrement).toHaveBeenCalledWith(
      'user:auth0|user456',
      UserTier.PRO,
    );
  });

  it('should use ip:{address} as identifier for unauthenticated requests', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: undefined,
          ip: '192.168.1.1',
          headers: {},
        }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(trackingService.checkAndIncrement).toHaveBeenCalledWith(
      'ip:192.168.1.1',
      UserTier.UNAUTHENTICATED,
    );
  });

  it('should apply separate quotas for different users on the same IP', async () => {
    // First user from IP 192.168.1.1
    const mockContext1 = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user1', tier: 'FREE' },
          ip: '192.168.1.1',
          headers: {},
        }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    // Second user from the same IP
    const mockContext2 = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user2', tier: 'FREE' },
          ip: '192.168.1.1',
          headers: {},
        }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const checkAndIncrementSpy = jest.spyOn(trackingService, 'checkAndIncrement');

    await guard.canActivate(mockContext1);
    await guard.canActivate(mockContext2);

    // Verify different identifiers were used for the same IP
    expect(checkAndIncrementSpy).toHaveBeenNthCalledWith(1, 'user:user1', UserTier.FREE);
    expect(checkAndIncrementSpy).toHaveBeenNthCalledWith(2, 'user:user2', UserTier.FREE);
    expect(checkAndIncrementSpy).not.toHaveBeenCalledWith('ip:192.168.1.1', expect.any(String));
  });

  it('should throw RateLimitExceededException when quota is exceeded', async () => {
    jest.spyOn(trackingService, 'checkAndIncrement').mockResolvedValue({
      allowed: false,
      remaining: { minute: 0, hour: 0, day: 0 },
      limit: { minute: 5, hour: 30, day: 100 },
      retryAfter: 60,
    });

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: undefined,
          ip: '192.168.1.1',
          headers: {},
        }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(RateLimitExceededException);
    expect(trackingService.checkAndIncrement).toHaveBeenCalledWith(
      'ip:192.168.1.1',
      UserTier.UNAUTHENTICATED,
    );
  });

  it('should bypass quota checks for admin users', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'admin1', role: 'admin' },
          ip: '192.168.1.1',
          headers: {},
        }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(trackingService.checkAndIncrement).not.toHaveBeenCalled();
  });

  it('should skip quota when @SkipQuota() is applied', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: undefined,
          ip: '192.168.1.1',
          headers: {},
        }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ skip: true });

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(trackingService.checkAndIncrement).not.toHaveBeenCalled();
  });
});
