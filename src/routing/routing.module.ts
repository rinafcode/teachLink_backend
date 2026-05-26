import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RoutingEngineService } from './services/routing-engine.service';
import { RoutingConfigService } from './services/routing-config.service';
import { ContentRoutingMiddleware } from './middleware/content-routing.middleware';
import { RoutingAdminController } from './controllers/routing-admin.controller';
import { RoutingGuard } from './guards/routing.guard';
import { RoutingInterceptor } from './interceptors/routing.interceptor';

/**
 * Module for content-based routing functionality
 */
@Module({
  imports: [ConfigModule],
  providers: [
    RoutingEngineService,
    RoutingConfigService,
    ContentRoutingMiddleware,
    RoutingGuard,
    RoutingInterceptor
  ],
  controllers: [RoutingAdminController],
  exports: [
    RoutingEngineService,
    RoutingConfigService,
    ContentRoutingMiddleware,
    RoutingGuard,
    RoutingInterceptor
  ]
})
export class RoutingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply content routing middleware to all routes
    // This should be applied early in the middleware chain
    consumer
      .apply(ContentRoutingMiddleware)
      .forRoutes('*');
  }
}