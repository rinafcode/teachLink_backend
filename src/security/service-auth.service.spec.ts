import { ServiceAuthService, ServiceIdentity } from './service-auth.service';
import { AuditLoggingService } from './audit/audit-logging.service';

describe('ServiceAuthService', () => {
  let service: ServiceAuthService;
  let auditLogging: jest.Mocked<AuditLoggingService>;

  const TEST_SERVICE_ID = 'test-service';
  const TEST_SERVICE: ServiceIdentity = {
    name: 'Test Service',
    secret: 'super-secret-key-for-testing-only',
  };

  beforeEach(() => {
    auditLogging = {
      log: jest.fn(),
      logLogin: jest.fn(),
      logDataAccess: jest.fn(),
      logDeletion: jest.fn(),
    } as unknown as jest.Mocked<AuditLoggingService>;

    service = new ServiceAuthService(auditLogging);
    service.registerService(TEST_SERVICE_ID, TEST_SERVICE);
  });

  describe('registerService / getRegisteredServiceCount', () => {
    it('registers a service and increments the count', () => {
      const before = service.getRegisteredServiceCount();
      service.registerService('another-service', { name: 'Another', secret: 'abc' });
      expect(service.getRegisteredServiceCount()).toBe(before + 1);
    });
  });

  describe('getServiceName', () => {
    it('returns the service name for a known id', () => {
      expect(service.getServiceName(TEST_SERVICE_ID)).toBe(TEST_SERVICE.name);
    });

    it('returns null for an unknown id', () => {
      expect(service.getServiceName('unknown')).toBeNull();
    });
  });

  describe('generateServiceToken', () => {
    it('returns a token with 4 dot-separated segments', () => {
      const token = service.generateServiceToken(TEST_SERVICE_ID);
      expect(token).not.toBeNull();
      expect(token!.split('.').length).toBe(4);
    });

    it('returns null for an unknown serviceId', () => {
      expect(service.generateServiceToken('unknown-service')).toBeNull();
    });

    it('includes the serviceId as the first segment', () => {
      const token = service.generateServiceToken(TEST_SERVICE_ID)!;
      expect(token.split('.')[0]).toBe(TEST_SERVICE_ID);
    });
  });

  describe('verifyServiceToken', () => {
    it('verifies a freshly generated token', () => {
      const token = service.generateServiceToken(TEST_SERVICE_ID)!;
      expect(service.verifyServiceToken(token)).toBe(true);
    });

    it('returns false for a malformed token (not 4 segments)', () => {
      expect(service.verifyServiceToken('bad.token')).toBe(false);
    });

    it('returns false for an unknown serviceId', () => {
      const token = service.generateServiceToken(TEST_SERVICE_ID)!;
      const tampered = token.replace(TEST_SERVICE_ID, 'unknown-svc');
      expect(service.verifyServiceToken(tampered)).toBe(false);
    });

    it('returns false when signature is tampered', () => {
      const token = service.generateServiceToken(TEST_SERVICE_ID)!;
      const parts = token.split('.');
      parts[3] = 'a'.repeat(parts[3].length);
      expect(service.verifyServiceToken(parts.join('.'))).toBe(false);
    });

    it('returns false for an expired token', () => {
      // Build a token with a timestamp far in the past (6 minutes ago)
      const parts = service.generateServiceToken(TEST_SERVICE_ID)!.split('.');
      parts[1] = (Date.now() - 6 * 60 * 1000).toString();
      const expired = parts.join('.');
      expect(service.verifyServiceToken(expired)).toBe(false);
    });

    it('returns false for a token with a future timestamp (clock-skew)', () => {
      const parts = service.generateServiceToken(TEST_SERVICE_ID)!.split('.');
      parts[1] = (Date.now() + 10 * 60 * 1000).toString();
      const future = parts.join('.');
      expect(service.verifyServiceToken(future)).toBe(false);
    });

    it('emits an audit log entry on success', () => {
      const token = service.generateServiceToken(TEST_SERVICE_ID)!;
      service.verifyServiceToken(token);
      expect(auditLogging.log).toHaveBeenCalledWith(
        'SERVICE_AUTH_SUCCESS',
        expect.objectContaining({ serviceId: TEST_SERVICE_ID }),
      );
    });

    it('emits an audit log entry on failure', () => {
      service.verifyServiceToken('bad.token.segments.here');
      // No audit log for malformed token (unknown serviceId, exits early)
      // But a tampered sig triggers the audit path:
      const token = service.generateServiceToken(TEST_SERVICE_ID)!;
      const parts = token.split('.');
      parts[3] = 'a'.repeat(parts[3].length);
      service.verifyServiceToken(parts.join('.'));
      expect(auditLogging.log).toHaveBeenCalledWith(
        'SERVICE_AUTH_FAILURE',
        expect.objectContaining({ serviceId: TEST_SERVICE_ID }),
      );
    });
  });
});
