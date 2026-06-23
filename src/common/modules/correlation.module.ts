import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { CorrelationIdMiddleware } from '../../middleware/correlation-id.middleware';

/**
 * CorrelationModule
 *
 * Registers `CorrelationIdMiddleware` for every route (`*`).
 * Import this module in `AppModule` (or any feature module that needs
 * per-request correlation tracking) to activate automatic propagation.
 *
 * The middleware:
 *  - Accepts an incoming `x-correlation-id` (or the legacy `x-request-id`).
 *  - Generates a fresh ID when none is provided.
 *  - Stores the ID in `AsyncLocalStorage` so `getCorrelationId()` works
 *    anywhere in the call stack without explicit parameter passing.
 *  - Echoes the ID on every response via `x-correlation-id`.
 *  - Logs request start and completion events with the ID attached.
 */
@Module({
  providers: [CorrelationIdMiddleware],
  exports: [CorrelationIdMiddleware],
})
export class CorrelationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
