import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { DebugController } from './debug.controller';
import { RequestCaptureService } from './services/request-capture.service';
import { RequestReplayService } from './services/request-replay.service';
import { PerformanceTimelineService } from './services/performance-timeline.service';
import { StackTraceService } from './services/stack-trace.service';
import { DebugCaptureMiddleware } from './middleware/debug-capture.middleware';

/**
 * DebuggingModule provides the developer debugging toolkit:
 *  - request/response capture & inspection
 *  - request replay with response diffing
 *  - per-request performance timelines
 *  - enhanced (structured) stack traces
 *
 * The capture middleware is only mounted outside production so it never adds
 * overhead to or retains payloads from real traffic. Set DEBUG_CAPTURE=true to
 * force-enable it (e.g. in staging) regardless of NODE_ENV.
 */
@Module({
  controllers: [DebugController],
  providers: [
    RequestCaptureService,
    RequestReplayService,
    PerformanceTimelineService,
    StackTraceService,
  ],
  exports: [
    RequestCaptureService,
    PerformanceTimelineService,
    StackTraceService,
  ],
})
export class DebuggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    const enabled =
      process.env.DEBUG_CAPTURE === 'true' ||
      (process.env.NODE_ENV ?? 'development') !== 'production';

    if (!enabled) return;

    consumer
      .apply(DebugCaptureMiddleware)
      // Don't capture the debugger's own endpoints — avoids recursive noise.
      .exclude({ path: 'debug/(.*)', method: RequestMethod.ALL })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
