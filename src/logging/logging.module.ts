import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AppLoggerService } from './app-logger.service';
import { LoggingInterceptor } from './logging.interceptor';
import { LoggingMiddleware } from './logging.middleware';

/**
 * LoggingModule
 * ─────────────
 * Centralised logging infrastructure.  Marked `@Global` so that
 * `AppLoggerService` can be injected anywhere without re-importing this module.
 *
 * What it provides
 * ────────────────
 * • `AppLoggerService` — structured, correlation-ID-aware logger.
 * • `LoggingInterceptor` — global HTTP request/response logger (registered via
 *   `APP_INTERCEPTOR` so it applies to every route automatically).
 * • `LoggingMiddleware` — echoes the correlation ID in response headers and
 *   logs the raw incoming request before any guard/pipe runs.
 *
 * Registration
 * ────────────
 * Import once in `AppModule`:
 *
 * ```ts
 * @Module({
 *   imports: [LoggingModule, ...],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({
  providers: [
    AppLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [AppLoggerService],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
