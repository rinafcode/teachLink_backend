import { LoggingInterceptor } from './logging.interceptor';
import { LogShipperService } from '../services/log-shipper.service';
import { of, firstValueFrom } from 'rxjs';

describe('LoggingInterceptor', () => {
  it('attaches and propagates correlation ID header', async () => {
    const mockShipper = { ship: jest.fn() } as unknown as LogShipperService;
    const interceptor = new LoggingInterceptor(mockShipper);

    const req: any = { method: 'GET', url: '/spam', headers: {} };
    const headers: Record<string, string> = {};
    const res: any = {
      statusCode: 200,
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      getHeader: (name: string) => headers[name.toLowerCase()],
    };

    const context: any = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    };

    const next: any = {
      handle: () => of({ success: true }),
    };

    await firstValueFrom(interceptor.intercept(context, next));

    const correlationId = res.getHeader('x-request-id');
    expect(typeof correlationId).toBe('string');
    expect(correlationId).toMatch(/^cid-/);
  });
});
