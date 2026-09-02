import { DeepLinkService } from './deep-link.service';

describe('DeepLinkService', () => {
  let service: DeepLinkService;

  beforeEach(() => {
    service = new DeepLinkService();
  });

  describe('validateRoute', () => {
    it('should return true for allowlisted routes', () => {
      expect(service.validateRoute('course')).toBe(true);
      expect(service.validateRoute('/course')).toBe(true);
    });

    it('should return false for non-allowlisted routes', () => {
      expect(service.validateRoute('admin')).toBe(false);
      expect(service.validateRoute('/admin')).toBe(false);
      expect(service.validateRoute('settings')).toBe(false);
      expect(service.validateRoute('')).toBe(false);
    });
  });

  describe('validateParam', () => {
    it('should accept valid alphanumeric params', () => {
      expect(service.validateParam('123')).toBe('123');
      expect(service.validateParam('abc')).toBe('abc');
      expect(service.validateParam('ABC')).toBe('ABC');
      expect(service.validateParam('course-123')).toBe('course-123');
      expect(service.validateParam('course_456')).toBe('course_456');
    });

    it('should trim whitespace from params', () => {
      expect(service.validateParam('  123  ')).toBe('123');
    });

    it('should reject empty params', () => {
      expect(() => service.validateParam('')).toThrow('Invalid parameter value');
      expect(() => service.validateParam('   ')).toThrow('Parameter value cannot be empty');
    });

    it('should reject absolute URLs', () => {
      expect(() => service.validateParam('http://evil.com')).toThrow(
        'Absolute URLs are not allowed',
      );
      expect(() => service.validateParam('https://evil.com')).toThrow(
        'Absolute URLs are not allowed',
      );
      expect(() => service.validateParam('ftp://evil.com')).toThrow(
        'Absolute URLs are not allowed',
      );
      expect(() => service.validateParam('//evil.com')).toThrow('Absolute URLs are not allowed');
    });

    it('should reject external URL schemes', () => {
      expect(() => service.validateParam('javascript:alert(1)')).toThrow(
        'External URL schemes are not allowed',
      );
      expect(() => service.validateParam('data:text/html,<script>alert(1)</script>')).toThrow(
        'External URL schemes are not allowed',
      );
      expect(() => service.validateParam('vbscript:msgbox(1)')).toThrow(
        'External URL schemes are not allowed',
      );
    });

    it('should reject path traversal attempts', () => {
      expect(() => service.validateParam('../secret')).toThrow('Path traversal is not allowed');
      expect(() => service.validateParam('..\\secret')).toThrow('Path traversal is not allowed');
      expect(() => service.validateParam('../../etc/passwd')).toThrow(
        'Path traversal is not allowed',
      );
      expect(() => service.validateParam('foo/../bar')).toThrow('Path traversal is not allowed');
    });

    it('should reject injection characters', () => {
      expect(() => service.validateParam('<script>')).toThrow('Invalid characters in parameter');
      expect(() => service.validateParam('>')).toThrow('Invalid characters in parameter');
      expect(() => service.validateParam('"')).toThrow('Invalid characters in parameter');
      expect(() => service.validateParam("'")).toThrow('Invalid characters in parameter');
      expect(() => service.validateParam('`')).toThrow('Invalid characters in parameter');
      expect(() => service.validateParam('{')).toThrow('Invalid characters in parameter');
      expect(() => service.validateParam('}')).toThrow('Invalid characters in parameter');
      expect(() => service.validateParam('\\')).toThrow('Invalid characters in parameter');
    });

    it('should reject invalid characters', () => {
      expect(() => service.validateParam('hello world')).toThrow(
        'Parameter contains invalid characters',
      );
      expect(() => service.validateParam('param@test')).toThrow(
        'Parameter contains invalid characters',
      );
      expect(() => service.validateParam('param#test')).toThrow(
        'Parameter contains invalid characters',
      );
      expect(() => service.validateParam('param?test')).toThrow(
        'Parameter contains invalid characters',
      );
    });
  });

  describe('buildDeepLink', () => {
    it('should build web deep link', () => {
      const link = service.buildDeepLink('web', 'course', '123');
      expect(link).toBe('/course/123');
    });

    it('should build app deep link', () => {
      const link = service.buildDeepLink('app', 'course', '456');
      expect(link).toBe('teachlink://course/456');
    });

    it('should pass valid params through unchanged', () => {
      const link = service.buildDeepLink('web', 'course', 'abc-123_456');
      expect(link).toBe('/course/abc-123_456');
    });

    it('should reject non-allowlisted routes', () => {
      expect(() => service.buildDeepLink('web', 'admin', '123')).toThrow(
        "Route 'admin' is not allowlisted",
      );
    });

    it('should reject invalid params', () => {
      expect(() => service.buildDeepLink('web', 'course', 'http://evil.com')).toThrow(
        'Absolute URLs are not allowed',
      );
      expect(() => service.buildDeepLink('app', 'course', '../secret')).toThrow(
        'Path traversal is not allowed',
      );
    });
  });

  describe('signLink and verifyLink', () => {
    it('should sign and verify a link', () => {
      const link = '/course/123';
      const signed = service.signLink(link);
      expect(signed).toMatch(/^\/course\/123\?sig=[a-f0-9]+$/);
      expect(service.verifyLink(signed)).toBe(true);
    });

    it('should reject tampered signatures', () => {
      const link = service.signLink('/course/123');
      const tampered = link.replace('123', '999');
      expect(service.verifyLink(tampered)).toBe(false);
    });

    it('should reject links without signature', () => {
      expect(service.verifyLink('/course/123')).toBe(false);
    });
  });
});
