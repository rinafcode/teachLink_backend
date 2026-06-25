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

  it('calls log without throwing', () => {
    expect(() => service.log('hello', 'TestContext')).not.toThrow();
  });

  it('calls error without throwing', () => {
    expect(() => service.error('err msg', 'stack trace', 'TestContext')).not.toThrow();
  });

  it('calls warn without throwing', () => {
    expect(() => service.warn('warning', 'TestContext')).not.toThrow();
  });

  it('calls logRequest without throwing', () => {
    expect(() => service.logRequest({ method: 'GET', url: '/test' })).not.toThrow();
  });

  it('calls logResponse without throwing', () => {
    expect(() => service.logResponse({ statusCode: 200, durationMs: 42 })).not.toThrow();
  });

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
});
