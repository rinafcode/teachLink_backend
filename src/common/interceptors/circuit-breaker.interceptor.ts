import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { EnhancedCircuitBreakerService } from '../services/circuit-breaker.service';
import {
  CIRCUIT_BREAKER_METADATA,
  CircuitBreakerDecoratorOptions,
} from '../decorators/circuit-breaker.decorator';

@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  constructor(
    private readonly circuitBreakerService: EnhancedCircuitBreakerService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<CircuitBreakerDecoratorOptions>(
      CIRCUIT_BREAKER_METADATA,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const key = options.key || `${context.getClass().name}.${context.getHandler().name}`;
    const fallback = options.fallback;

    return from(
      this.circuitBreakerService.execute(key, () => next.handle().toPromise(), {
        ...options,
        name: key,
        fallback: fallback
          ? async (error: Error) => {
              const fallbackResult = await fallback(error);
              return fallbackResult;
            }
          : undefined,
      }),
    ).pipe(
      catchError((error) => {
        if (error instanceof HttpException) {
          return throwError(() => error);
        }

        // Return 503 Service Unavailable when circuit is open
        return throwError(
          () =>
            new HttpException(
              'Service temporarily unavailable (circuit breaker open)',
              HttpStatus.SERVICE_UNAVAILABLE,
            ),
        );
      }),
    );
  }
}
