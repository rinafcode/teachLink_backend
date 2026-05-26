import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { ROUTING_METADATA_KEY } from '../decorators/routing.decorator';

/**
 * Interceptor that can modify responses based on routing context
 */
@Injectable()
export class RoutingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RoutingInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // Get routing result from middleware or guard
    const routingResult = request.routingResult;
    
    // Get routing metadata from decorators
    const routingMetadata = this.reflector.getAllAndOverride<Record<string, any>>(ROUTING_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map(data => {
        // Apply response transformations based on routing context
        if (routingResult?.matched) {
          return this.transformResponse(data, routingResult, routingMetadata);
        }
        return data;
      }),
      tap(() => {
        // Apply response headers based on routing
        this.applyResponseHeaders(response, routingResult, routingMetadata);
      })
    );
  }

  /**
   * Transforms response data based on routing context
   */
  private transformResponse(data: any, routingResult: any, metadata?: any): any {
    let transformedData = data;

    // Apply mobile optimizations
    if (this.isMobileOptimized(routingResult, metadata)) {
      transformedData = this.applyMobileOptimizations(transformedData);
    }

    // Apply API version transformations
    if (this.hasApiVersionContext(routingResult, metadata)) {
      transformedData = this.applyApiVersionTransformations(transformedData, routingResult, metadata);
    }

    // Apply beta feature transformations
    if (this.hasBetaFeatures(routingResult, metadata)) {
      transformedData = this.applyBetaTransformations(transformedData);
    }

    return transformedData;
  }

  /**
   * Applies response headers based on routing context
   */
  private applyResponseHeaders(response: any, routingResult: any, metadata?: any): void {
    // Add routing information headers
    if (routingResult?.matched) {
      response.setHeader('X-Routing-Rule', routingResult.rule?.name || 'unknown');
      response.setHeader('X-Routing-Action', routingResult.action?.type || 'none');
    }

    // Apply cache headers if specified
    if (routingResult?.action?.type === 'cache' || metadata?.cache) {
      const cacheConfig = routingResult?.action?.parameters || metadata?.cache;
      if (cacheConfig?.cacheControl) {
        response.setHeader('Cache-Control', cacheConfig.cacheControl);
      }
      if (cacheConfig?.maxAge) {
        response.setHeader('X-Cache-Max-Age', cacheConfig.maxAge);
      }
    }

    // Apply mobile optimization headers
    if (this.isMobileOptimized(routingResult, metadata)) {
      response.setHeader('X-Mobile-Optimized', 'true');
      response.setHeader('X-Response-Format', 'compact');
    }

    // Apply API version headers
    if (this.hasApiVersionContext(routingResult, metadata)) {
      const version = metadata?.apiVersion || this.extractApiVersion(routingResult);
      if (version) {
        response.setHeader('X-API-Version', version);
      }
    }

    // Apply beta feature headers
    if (this.hasBetaFeatures(routingResult, metadata)) {
      response.setHeader('X-Beta-Features', 'enabled');
    }
  }

  /**
   * Checks if mobile optimization should be applied
   */
  private isMobileOptimized(routingResult: any, metadata?: any): boolean {
    return (
      routingResult?.transformedRequest?.headers?.['x-mobile-optimized'] === 'true' ||
      metadata?.clientType === 'mobile' ||
      routingResult?.rule?.id?.includes('mobile')
    );
  }

  /**
   * Checks if API version context exists
   */
  private hasApiVersionContext(routingResult: any, metadata?: any): boolean {
    return (
      metadata?.apiVersion ||
      routingResult?.transformedRequest?.headers?.['x-api-version'] ||
      routingResult?.rule?.id?.includes('api-version')
    );
  }

  /**
   * Checks if beta features are enabled
   */
  private hasBetaFeatures(routingResult: any, metadata?: any): boolean {
    return (
      routingResult?.transformedRequest?.headers?.['x-beta-features'] === 'enabled' ||
      metadata?.featureFlag === 'beta' ||
      routingResult?.rule?.id?.includes('beta')
    );
  }

  /**
   * Applies mobile-specific optimizations to response data
   */
  private applyMobileOptimizations(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Example mobile optimizations
    const optimized = { ...data };

    // Remove heavy fields for mobile
    if (optimized.metadata) {
      delete optimized.metadata.fullDescription;
      delete optimized.metadata.detailedAnalytics;
    }

    // Compress arrays for mobile
    if (Array.isArray(optimized.items) && optimized.items.length > 10) {
      optimized.items = optimized.items.slice(0, 10);
      optimized.hasMore = true;
    }

    // Add mobile-specific fields
    optimized._mobile = {
      optimized: true,
      timestamp: new Date().toISOString()
    };

    return optimized;
  }

  /**
   * Applies API version-specific transformations
   */
  private applyApiVersionTransformations(data: any, routingResult: any, metadata?: any): any {
    const version = metadata?.apiVersion || this.extractApiVersion(routingResult);
    
    if (!version || !data || typeof data !== 'object') {
      return data;
    }

    const transformed = { ...data };

    // Apply version-specific transformations
    switch (version) {
      case 'v2':
        // V2 API transformations
        if (transformed.created_at) {
          transformed.createdAt = transformed.created_at;
          delete transformed.created_at;
        }
        if (transformed.updated_at) {
          transformed.updatedAt = transformed.updated_at;
          delete transformed.updated_at;
        }
        break;
      
      case 'v1':
        // V1 API transformations (legacy support)
        if (transformed.createdAt) {
          transformed.created_at = transformed.createdAt;
          delete transformed.createdAt;
        }
        break;
    }

    return transformed;
  }

  /**
   * Applies beta feature transformations
   */
  private applyBetaTransformations(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const transformed = { ...data };

    // Add beta-specific fields
    transformed._beta = {
      enabled: true,
      features: ['enhanced-search', 'real-time-updates'],
      timestamp: new Date().toISOString()
    };

    // Include experimental data
    if (transformed.analytics) {
      transformed.analytics.experimental = {
        predictiveScores: Math.random(),
        behaviorInsights: 'beta-feature-data'
      };
    }

    return transformed;
  }

  /**
   * Extracts API version from routing result
   */
  private extractApiVersion(routingResult: any): string | null {
    if (routingResult?.transformedRequest?.headers?.['x-api-version']) {
      return routingResult.transformedRequest.headers['x-api-version'];
    }
    
    if (routingResult?.rule?.id?.includes('api-v')) {
      const match = routingResult.rule.id.match(/api-v(\d+)/);
      return match ? `v${match[1]}` : null;
    }

    return null;
  }
}