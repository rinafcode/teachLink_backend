import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadGatewayException,
} from '@nestjs/common';
import { Observable, TimeoutError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

export const DEFAULT_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '10000', 10); // ms

export function Timeout(ms?: number): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata('timeout', ms, descriptor.value!);
  };
}

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const customTimeout = Reflect.getMetadata('timeout', handler);
    const timeoutValue = customTimeout || DEFAULT_TIMEOUT;
    return next.handle().pipe(
      timeout(timeoutValue),
      catchError(err => {
        if (err instanceof TimeoutError) {
          throw new BadGatewayException({
            statusCode: 504,
            message: 'Request timed out',
            error: 'Timeout',
            timestamp: new Date().toISOString(),
          });
        }
        throw err;
      })
    );
  }
}
