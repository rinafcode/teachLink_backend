import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadGatewayException, Logger, Inject, } from '@nestjs/common';
import { Observable, TimeoutError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { TimeoutConfigService } from '../timeout/timeout-config.service';
export const DEFAULT_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '30000', 10); // 30 seconds default
export function Timeout(ms?: number): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        Reflect.defineMetadata('timeout', ms, descriptor.value ?? target);
    };
}
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
    private readonly logger = new Logger(TimeoutInterceptor.name);
    constructor(
    @Inject(TimeoutConfigService)
    private timeoutConfig: TimeoutConfigService) { }
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const handler = context.getHandler();
        const customTimeout = Reflect.getMetadata('timeout', handler);
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        const url = request.url;
        // Determine timeout value with priority: decorator > config service > default
        let timeoutValue: number;
        if (customTimeout) {
            timeoutValue = customTimeout;
            this.logger.debug(`Using decorator timeout of ${timeoutValue}ms for ${method} ${url}`);
        }
        else {
            timeoutValue = this.timeoutConfig.getTimeoutForRequest(method, url);
            this.logger.debug(`Using config timeout of ${timeoutValue}ms for ${method} ${url}`);
        }
        return next.handle().pipe(timeout(timeoutValue), catchError((err) => {
            if (err instanceof TimeoutError) {
                this.logger.warn(`Request timeout: ${method} ${url} after ${timeoutValue}ms`);
                throw new BadGatewayException({
                    statusCode: 504,
                    message: `Request timed out after ${timeoutValue}ms`,
                    error: 'Timeout',
                    timestamp: new Date().toISOString(),
                    path: url,
                    method,
                });
            }
            throw err;
        }));
    }
}
