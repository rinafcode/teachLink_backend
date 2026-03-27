import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ApiVersionInterceptor } from './api-version.interceptor';
import { ApiVersionGuard } from './api-version.interceptor';

/**
 * API Versioning Module
 * 
 * Provides:
 * - URL-based versioning (/api/v1/, /api/v2/)
 * - Header-based versioning (X-API-Version, Accept header)
 * - Query parameter versioning (?version=v1)
 * - Version routing strategy
 */
@Module({
  providers: [ApiVersionInterceptor, ApiVersionGuard],
  exports: [ApiVersionInterceptor, ApiVersionGuard],
})
export class ApiVersioningModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply version interceptor to all routes
    consumer
      .apply((req, res, next) => {
        // The interceptor will be applied globally
        next();
      })
      .forRoutes('*');
  }
}

// Re-export for convenience
export { ApiVersionInterceptor, ApiVersionGuard } from './api-version.interceptor';
export { ApiVersion, VersionedRequest } from './api-version.interceptor';