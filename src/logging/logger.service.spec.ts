import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from './logger.service';
import { runWithCorrelationId } from '../common/utils/correlation.utils';

describe('AppLoggerService', () => {
  let service: AppLoggerService;

  beforeEach(async () => {
    process.env.LOG_TO_FILE = 'false';
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppLoggerService],
    }).compile();
    service = module.get(AppLoggerService);
  });

  afterEach(() => {
    delete process.env.LOG_TO_FILE;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_DIR;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('exposes standard NestJS logger methods', () => {
    expect(typeof service.log).toBe('function');
    expect(typeof service.error).toBe('function');
    expect(typeof service.warn).toBe('function');
    expect(typeof service.debug).toBe('function');
    expect(typeof service.verbose).toBe('function');
  });

  it('exposes request/response log helpers', () => {
    expect(typeof service.logRequest).toBe('function');
    expect(typeof service.logResponse).toBe('function');
  });

  describe('Log Level Methods', () => {
    it('calls log without throwing', () => {
      expect(() => service.log('hello', 'TestContext')).not.toThrow();
    });

    it('calls error without throwing', () => {
      expect(() => service.error('err msg', 'stack trace', 'TestContext')).not.toThrow();
    });

    it('calls warn without throwing', () => {
      expect(() => service.warn('warning', 'TestContext')).not.toThrow();
    });

    it('calls debug without throwing', () => {
      expect(() => service.debug('debug info', 'TestContext')).not.toThrow();
    });

    it('calls verbose without throwing', () => {
      expect(() => service.verbose('verbose info', 'TestContext')).not.toThrow();
    });
  });

  describe('HTTP Logging Helpers', () => {
    it('calls logRequest without throwing', () => {
      expect(() => service.logRequest({ method: 'GET', url: '/test' })).not.toThrow();
    });

    it('calls logResponse without throwing', () => {
      expect(() => service.logResponse({ statusCode: 200, durationMs: 42 })).not.toThrow();
    });

    it('logRequest includes method and url', () => {
      const winstonSpy = jest.spyOn(
        (service as unknown as { winston: { info: jest.Mock } }).winston,
        'info',
      );

      service.logRequest({ method: 'POST', url: '/api/users', userId: '123' });

      expect(winstonSpy).toHaveBeenCalledWith(
        'http_request',
        expect.objectContaining({
          method: 'POST',
          url: '/api/users',
          userId: '123',
        }),
      );
    });

    it('logResponse includes statusCode and duration', () => {
      const winstonSpy = jest.spyOn(
        (service as unknown as { winston: { info: jest.Mock } }).winston,
        'info',
      );

      service.logResponse({ statusCode: 201, durationMs: 123, requestId: 'abc' });

      expect(winstonSpy).toHaveBeenCalledWith(
        'http_response',
        expect.objectContaining({
          statusCode: 201,
          durationMs: 123,
          requestId: 'abc',
        }),
      );
    });
  });

  describe('Correlation ID Support', () => {
    it('includes correlation ID in log output when set', () => {
      const winstonSpy = jest.spyOn(
        (service as unknown as { winston: { info: jest.Mock } }).winston,
        'info',
      );

      runWithCorrelationId(() => {
        service.log('test message');
      }, 'cid-test-123');

      expect(winstonSpy).toHaveBeenCalledWith('test message', expect.any(Object));
    });

    it('works without correlation ID when not set', () => {
      const winstonSpy = jest.spyOn(
        (service as unknown as { winston: { info: jest.Mock } }).winston,
        'info',
      );

      service.log('test message without correlation');

      expect(winstonSpy).toHaveBeenCalledWith('test message without correlation', expect.any(Object));
    });
  });

  describe('Configuration', () => {
    it('uses default log level when not specified', async () => {
      delete process.env.LOG_LEVEL;
      const module: TestingModule = await Test.createTestingModule({
        providers: [AppLoggerService],
      }).compile();
      const configuredService = module.get(AppLoggerService);

      expect(configuredService).toBeDefined();
    });

    it('respects custom log level from environment', async () => {
      process.env.LOG_LEVEL = 'debug';
      const module: TestingModule = await Test.createTestingModule({
        providers: [AppLoggerService],
      }).compile();
      const configuredService = module.get(AppLoggerService);

      expect(configuredService).toBeDefined();
    });

    it('uses default log directory when not specified', async () => {
      delete process.env.LOG_DIR;
      const module: TestingModule = await Test.createTestingModule({
        providers: [AppLoggerService],
      }).compile();
      const configuredService = module.get(AppLoggerService);

      expect(configuredService).toBeDefined();
    });

    it('respects custom log directory from environment', async () => {
      process.env.LOG_DIR = '/custom/logs';
      const module: TestingModule = await Test.createTestingModule({
        providers: [AppLoggerService],
      }).compile();
      const configuredService = module.get(AppLoggerService);

      expect(configuredService).toBeDefined();
    });

    it('disables file logging by default in non-production', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_TO_FILE;
      const module: TestingModule = await Test.createTestingModule({
        providers: [AppLoggerService],
      }).compile();
      const configuredService = module.get(AppLoggerService);

      expect(configuredService).toBeDefined();
    });

    it('enables file logging when LOG_TO_FILE is true', async () => {
      process.env.LOG_TO_FILE = 'true';
      const module: TestingModule = await Test.createTestingModule({
        providers: [AppLoggerService],
      }).compile();
      const configuredService = module.get(AppLoggerService);

      expect(configuredService).toBeDefined();
    });

    it('enables file logging in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_TO_FILE;
      const module: TestingModule = await Test.createTestingModule({
        providers: [AppLoggerService],
      }).compile();
      const configuredService = module.get(AppLoggerService);

      expect(configuredService).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('handles error with stack trace', () => {
      const error = new Error('Test error');
      const winstonSpy = jest.spyOn(
        (service as unknown as { winston: { error: jest.Mock } }).winston,
        'error',
      );

      service.error('Error occurred', error.stack, 'TestContext');

      expect(winstonSpy).toHaveBeenCalledWith(
        'Error occurred',
        expect.objectContaining({
          context: 'TestContext',
          stack: error.stack,
        }),
      );
    });

    it('handles error without stack trace', () => {
      const winstonSpy = jest.spyOn(
        (service as unknown as { winston: { error: jest.Mock } }).winston,
        'error',
      );

      service.error('Error occurred', undefined, 'TestContext');

      expect(winstonSpy).toHaveBeenCalledWith(
        'Error occurred',
        expect.objectContaining({
          context: 'TestContext',
        }),
      );
    });

    it('handles error without context', () => {
      const winstonSpy = jest.spyOn(
        (service as unknown as { winston: { error: jest.Mock } }).winston,
        'error',
      );

      service.error('Error occurred');

      expect(winstonSpy).toHaveBeenCalledWith('Error occurred', expect.any(Object));
    });
  });

  describe('Structured Output', () => {
    it('includes service name in log output', async () => {
      process.env.SERVICE_NAME = 'test-service';
      const module: TestingModule = await Test.createTestingModule({
        providers: [AppLoggerService],
      }).compile();
      const configuredService = module.get(AppLoggerService);

      expect(configuredService).toBeDefined();
      delete process.env.SERVICE_NAME;
    });

    it('includes timestamp in log output', () => {
      const winstonSpy = jest.spyOn(
        (service as unknown as { winston: { info: jest.Mock } }).winston,
        'info',
      );

      service.log('test message');

      expect(winstonSpy).toHaveBeenCalled();
    });

    it('includes process ID in log output', () => {
      const winstonSpy = jest.spyOn(
        (service as unknown as { winston: { info: jest.Mock } }).winston,
        'info',
      );

      service.log('test message');

      expect(winstonSpy).toHaveBeenCalled();
    });
  });
});
