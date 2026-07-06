import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import {
  CORRELATION_ID_HEADER,
  getCorrelationId,
  X_CORRELATION_ID_HEADER,
} from '../../common/utils/correlation.utils';
import { Request, Response } from 'express';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationIdMiddleware],
    }).compile();

    middleware = module.get(CorrelationIdMiddleware);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('generates a correlation ID when inbound headers are absent', (done) => {
    const headers: Record<string, string> = {};
    const req = { method: 'GET', url: '/health', headers: {} } as Request;
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
    } as unknown as Response;

    middleware.use(req, res, () => {
      expect(getCorrelationId()).toBeDefined();
      expect(headers[X_CORRELATION_ID_HEADER]).toBeDefined();
      expect(headers[CORRELATION_ID_HEADER]).toBe(headers[X_CORRELATION_ID_HEADER]);
      done();
    });
  });

  it('preserves an inbound correlation ID', (done) => {
    const incoming = 'existing-correlation-id';
    const headers: Record<string, string> = {};
    const req = {
      method: 'POST',
      url: '/courses',
      headers: { [X_CORRELATION_ID_HEADER]: incoming },
    } as unknown as Request;
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
    } as unknown as Response;

    middleware.use(req, res, () => {
      expect(getCorrelationId()).toBe(incoming);
      expect(headers[X_CORRELATION_ID_HEADER]).toBe(incoming);
      done();
    });
  });
});
