import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { CanaryMetricsService } from './canary-metrics.service';
import { TrafficMirrorMiddleware } from '../common/middleware/traffic-mirror.middleware';

@Module({
  providers: [CanaryMetricsService],
  exports: [CanaryMetricsService],
})
export class CanaryModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TrafficMirrorMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
