import { ConsoleLogger } from '@nestjs/common';
import { AppLoggerService, AppLogLevel, IAppLogRecord } from './app-logger.service';
import * as correlationUtils from '../common/utils/correlation.utils';
import { REDACTED } from './redaction.util';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AppLoggerService', () => {
  let logger: AppLoggerService;

  beforeEach(async () => {
    logger = new AppLoggerService('TestContext');
    jest.spyOn(correlationUtils, 'getCorrelationId').mockReturnValue('test-correlation-id');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Capture the last structured record emitted by the real _emit → super.log path. */
  function captureRecords(): { records: IAppLogRecord[]; restore: () => void } {
    const records: IAppLogRecord[] = [];

    const capture = (serialised: unknown): void => {
      try { records.push(JSON.parse(String(serialised)) as IAppLogRecord); } catch { /* ignore */ }
    };

    // ConsoleLogger routes everything through these three base methods
    const debugSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)) as ConsoleLogger, 'debug').mockImplementation(capture);
    const logSpy   = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)) as ConsoleLogger, 'log').mockImplementation(capture);
    const warnSpy  = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)) as ConsoleLogger, 'warn').mockImplementation(capture);
    const errSpy   = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)) as ConsoleLogger, 'error').mockImplementation(capture);
    const fatalSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)) as ConsoleLogger, 'fatal').mockImplementation(capture);

    const restore = (): void => {
      debugSpy.mockRestore();
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errSpy.mockRestore();
      fatalSpy.mockRestore();
    };

    return { records, restore };
  }

  // ── instantiation ──────────────────────────────────────────────────────────

  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should allow context to be updated via setContext()', () => {
    logger.setContext('MyService');
    const { records, restore } = captureRecords();
    logger.info('hello');
    restore();
    expect(records[0]?.context).toBe('MyService');
  });

  // ── log levels ─────────────────────────────────────────────────────────────

  describe('log levels', () => {
    it('should emit level=debug for debug()', () => {
      const { records, restore } = captureRecords();
      logger.debug('msg');
      restore();
      expect(records[0]?.level).toBe(AppLogLevel.DEBUG);
    });

    it('should emit level=info for info()', () => {
      const { records, restore } = captureRecords();
      logger.info('msg');
      restore();
      expect(records[0]?.level).toBe(AppLogLevel.INFO);
    });

    it('should emit level=info for log()', () => {
      const { records, restore } = captureRecords();
      logger.log('msg');
      restore();
      expect(records[0]?.level).toBe(AppLogLevel.INFO);
    });

    it('should emit level=warn for warn()', () => {
      const { records, restore } = captureRecords();
      logger.warn('msg');
      restore();
      expect(records[0]?.level).toBe(AppLogLevel.WARN);
    });

    it('should emit level=error for error()', () => {
      const { records, restore } = captureRecords();
      logger.error('msg', new Error('boom'));
      restore();
      expect(records[0]?.level).toBe(AppLogLevel.ERROR);
    });

    it('should emit level=fatal for fatal()', () => {
      const { records, restore } = captureRecords();
      logger.fatal('msg');
      restore();
      expect(records[0]?.level).toBe(AppLogLevel.FATAL);
    });
  });

  // ── correlation ID ─────────────────────────────────────────────────────────

  describe('correlation ID', () => {
    it('should include correlationId from AsyncLocalStorage', () => {
      const { records, restore } = captureRecords();
      logger.info('with correlation');
      restore();
      expect(records[0]?.correlationId).toBe('test-correlation-id');
    });

    it('should include undefined correlationId when none is set', () => {
      jest.spyOn(correlationUtils, 'getCorrelationId').mockReturnValue(undefined);
      const { records, restore } = captureRecords();
      logger.info('without correlation');
      restore();
      expect(records[0]?.correlationId).toBeUndefined();
    });
  });

  // ── structured fields ──────────────────────────────────────────────────────

  describe('structured fields', () => {
    it('should include timestamp in ISO format', () => {
      const { records, restore } = captureRecords();
      logger.info('timestamped');
      restore();
      expect(records[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include message field', () => {
      const { records, restore } = captureRecords();
      logger.info('hello world');
      restore();
      expect(records[0]?.message).toBe('hello world');
    });

    it('should attach metadata when provided', () => {
      const { records, restore } = captureRecords();
      logger.info('with metadata', { foo: 'bar' });
      restore();
      expect(records[0]?.metadata?.['foo']).toBe('bar');
    });
  });

  // ── error serialisation ────────────────────────────────────────────────────

  describe('error serialisation', () => {
    it('should serialise Error object into error field', () => {
      const { records, restore } = captureRecords();
      logger.error('request failed', new Error('something went wrong'));
      restore();
      expect(records[0]?.error?.message).toBe('something went wrong');
      expect(records[0]?.error?.name).toBe('Error');
    });

    it('should handle string trace without throwing', () => {
      const { records, restore } = captureRecords();
      expect(() => logger.error('failed', 'stack trace string')).not.toThrow();
      restore();
      expect(records[0]?.level).toBe(AppLogLevel.ERROR);
    });
  });

  // ── convenience methods ────────────────────────────────────────────────────

  describe('logRequest()', () => {
    it('should include type=http_request, statusCode, and durationMs', () => {
      const { records, restore } = captureRecords();
      logger.logRequest('GET', '/health', 200, 12);
      restore();
      expect(records[0]?.metadata?.['type']).toBe('http_request');
      expect(records[0]?.metadata?.['statusCode']).toBe(200);
      expect(records[0]?.metadata?.['durationMs']).toBe(12);
    });
  });

  describe('logEvent()', () => {
    it('should include type=business_event and eventName', () => {
      const { records, restore } = captureRecords();
      logger.logEvent('user.enrolled', { userId: 'u1' });
      restore();
      expect(records[0]?.metadata?.['type']).toBe('business_event');
      expect(records[0]?.metadata?.['eventName']).toBe('user.enrolled');
    });
  });

  describe('logQuery()', () => {
    it('should emit at debug level with type=db_query', () => {
      const { records, restore } = captureRecords();
      logger.logQuery('SELECT 1', 5);
      restore();
      expect(records[0]?.level).toBe(AppLogLevel.DEBUG);
      expect(records[0]?.metadata?.['type']).toBe('db_query');
    });
  });

  // ── sensitive data redaction ───────────────────────────────────────────────

  describe('sensitive data redaction', () => {
    it('should redact password field from metadata', () => {
      const { records, restore } = captureRecords();
      logger.info('login attempt', { username: 'alice', password: 'hunter2' });
      restore();
      expect(records[0]?.metadata?.['password']).toBe(REDACTED);
      expect(records[0]?.metadata?.['username']).toBe('alice');
    });

    it('should redact accessToken from metadata', () => {
      const { records, restore } = captureRecords();
      logger.info('token refresh', { accessToken: 'eyJhbGc...' });
      restore();
      expect(records[0]?.metadata?.['accessToken']).toBe(REDACTED);
    });

    it('should redact nested sensitive fields', () => {
      const { records, restore } = captureRecords();
      logger.info('nested', { user: { email: 'u@x.com', password: 'pw' } });
      restore();
      const user = records[0]?.metadata?.['user'] as Record<string, unknown>;
      expect(user?.['password']).toBe(REDACTED);
    });

    it('should NOT redact non-sensitive fields', () => {
      const { records, restore } = captureRecords();
      logger.info('safe', { courseId: 'c-1', title: 'NestJS 101' });
      restore();
      expect(records[0]?.metadata?.['courseId']).toBe('c-1');
      expect(records[0]?.metadata?.['title']).toBe('NestJS 101');
    });
  });
});
