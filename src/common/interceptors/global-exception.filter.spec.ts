import { GlobalExceptionFilter } from './global-exception.filter';
import { HttpStatus } from '@nestjs/common';
import { runWithCorrelationId } from '../utils/correlation.utils';

describe('GlobalExceptionFilter', () => {
  it('adds correlation ID to error response and header', () => {
    const filter = new GlobalExceptionFilter();

    const req: any = { method: 'GET', url: '/test' };
    const responseHeaders: Record<string, string> = {};
    const res: any = {
      status: (code: number) => {
        res.statusCode = code;
        return res;
      },
      json: (body: any) => {
        res.body = body;
        return res;
      },
      setHeader: (name: string, value: string) => {
        responseHeaders[name.toLowerCase()] = value;
      },
      getHeader: (name: string) => responseHeaders[name.toLowerCase()],
    };

    runWithCorrelationId(() => {
      filter.catch(new Error('Test error'), {
        switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      } as any);
    }, 'cid-123');

    const body = res.body;

    expect(res.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.correlationId).toBe('cid-123');
    expect(body.message).toBe('Test error');
  });
});
