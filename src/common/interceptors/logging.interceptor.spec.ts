import { LoggingInterceptor } from './logging.interceptor';
import { of, firstValueFrom } from 'rxjs';
describe('LoggingInterceptor', () => {
    it('attaches and propagates correlation ID header', async () => {
        const interceptor = new LoggingInterceptor();
        const req: unknown = { method: 'GET', url: '/spam', headers: {} };
        const headers: Record<string, string> = {};
        const res: unknown = {
            statusCode: 200,
            setHeader: (name: string, value: string) => {
                headers[name.toLowerCase()] = value;
            },
            getHeader: (name: string) => headers[name.toLowerCase()],
        };
        const context: unknown = {
            getType: () => 'http',
            switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
        };
        const next: unknown = {
            handle: () => of({ success: true }),
        };
        await firstValueFrom(interceptor.intercept(context, next));
        const correlationId = res.getHeader('x-request-id');
        expect(typeof correlationId).toBe('string');
        expect(correlationId).toMatch(/^cid-/);
    });
});
