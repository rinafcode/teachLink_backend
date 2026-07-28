import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ZeroTrustGuard } from './zero-trust.guard';
import { AuditLoggingService } from './audit/audit-logging.service';
import { ServiceAuthService } from './service-auth.service';

function makeContext(headers: Record<string, string>, path = '/api/courses'): ExecutionContext {
  const req = {
    headers,
    path,
    url: path,
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('ZeroTrustGuard', () => {
  let guard: ZeroTrustGuard;
  let auditLogging: jest.Mocked<AuditLoggingService>;
  let serviceAuth: jest.Mocked<ServiceAuthService>;

  beforeEach(() => {
    auditLogging = {
      log: jest.fn(),
      logLogin: jest.fn(),
      logDataAccess: jest.fn(),
      logDeletion: jest.fn(),
    } as unknown as jest.Mocked<AuditLoggingService>;

    serviceAuth = {
      verifyServiceToken: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<ServiceAuthService>;

    guard = new ZeroTrustGuard(auditLogging, serviceAuth);
  });

  describe('isPublicPath', () => {
    it('allows /health', () => {
      expect(ZeroTrustGuard.isPublicPath('/health')).toBe(true);
    });

    it('allows /metrics', () => {
      expect(ZeroTrustGuard.isPublicPath('/metrics')).toBe(true);
    });

    it('allows /api/docs and sub-paths', () => {
      expect(ZeroTrustGuard.isPublicPath('/api/docs')).toBe(true);
      expect(ZeroTrustGuard.isPublicPath('/api/docs/swagger-ui.js')).toBe(true);
    });

    it('does not allow arbitrary paths', () => {
      expect(ZeroTrustGuard.isPublicPath('/api/courses')).toBe(false);
      expect(ZeroTrustGuard.isPublicPath('/users')).toBe(false);
    });
  });

  describe('canActivate', () => {
    it('passes public paths without any credentials', () => {
      const ctx = makeContext({}, '/health');
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows requests with a Bearer token', () => {
      const ctx = makeContext({ authorization: 'Bearer some.jwt.token' });
      expect(guard.canActivate(ctx)).toBe(true);
      expect(auditLogging.log).toHaveBeenCalledWith(
        'ZERO_TRUST_USER_AUTH',
        expect.objectContaining({ result: 'ALLOWED' }),
      );
    });

    it('allows requests with a valid service token', () => {
      serviceAuth.verifyServiceToken.mockReturnValue(true);
      const ctx = makeContext({ 'x-service-token': 'valid.token.here.sig' });
      expect(guard.canActivate(ctx)).toBe(true);
      expect(auditLogging.log).toHaveBeenCalledWith(
        'ZERO_TRUST_SERVICE_AUTH',
        expect.objectContaining({ result: 'ALLOWED' }),
      );
    });

    it('rejects requests with an invalid service token', () => {
      serviceAuth.verifyServiceToken.mockReturnValue(false);
      const ctx = makeContext({ 'x-service-token': 'bad.token.here.sig' });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
      expect(auditLogging.log).toHaveBeenCalledWith(
        'ZERO_TRUST_SERVICE_AUTH',
        expect.objectContaining({ result: 'DENIED', reason: 'invalid_service_token' }),
      );
    });

    it('rejects requests with no credentials', () => {
      const ctx = makeContext({});
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
      expect(auditLogging.log).toHaveBeenCalledWith(
        'ZERO_TRUST_DENY',
        expect.objectContaining({ result: 'DENIED', reason: 'no_identity_credential' }),
      );
    });

    it('uses X-Forwarded-For for IP extraction', () => {
      const ctx = makeContext({
        authorization: 'Bearer token',
        'x-forwarded-for': '10.0.0.1, 10.0.0.2',
      });
      guard.canActivate(ctx);
      expect(auditLogging.log).toHaveBeenCalledWith(
        'ZERO_TRUST_USER_AUTH',
        expect.objectContaining({ ip: '10.0.0.1' }),
      );
    });
  });
});
