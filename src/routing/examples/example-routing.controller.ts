import { Controller, Get, Post, Body, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  ApiVersion,
  ClientType,
  FeatureFlag,
  TenantSpecific,
  RateLimit,
  CacheControl,
  BypassRouting,
  RoutingMetadata
} from '../decorators/routing.decorator';
import { RoutingGuard } from '../guards/routing.guard';
import { RoutingInterceptor } from '../interceptors/routing.interceptor';

/**
 * Example controller demonstrating routing decorators and features
 */
@ApiTags('routing-examples')
@Controller('examples/routing')
@UseGuards(RoutingGuard)
@UseInterceptors(RoutingInterceptor)
export class ExampleRoutingController {

  /**
   * Example endpoint with API version routing
   */
  @Get('api-version')
  @ApiVersion('v2')
  @ApiOperation({ summary: 'Example of API version routing' })
  @ApiResponse({ status: 200, description: 'Returns version-specific response' })
  getApiVersionExample() {
    return {
      message: 'This endpoint uses API version routing',
      version: 'v2',
      features: ['enhanced-response', 'new-fields'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Example endpoint with mobile client optimization
   */
  @Get('mobile')
  @ClientType('mobile')
  @ApiOperation({ summary: 'Example of mobile client routing' })
  @ApiResponse({ status: 200, description: 'Returns mobile-optimized response' })
  getMobileExample() {
    return {
      message: 'This endpoint is optimized for mobile clients',
      data: {
        title: 'Mobile Content',
        summary: 'Compact summary for mobile',
        // Heavy fields would be removed by the interceptor
        metadata: {
          fullDescription: 'This would be removed for mobile clients',
          detailedAnalytics: { /* complex data */ }
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Example endpoint with feature flag routing
   */
  @Get('beta-features')
  @FeatureFlag('beta')
  @ApiOperation({ summary: 'Example of beta feature routing' })
  @ApiResponse({ status: 200, description: 'Returns beta features response' })
  getBetaFeaturesExample() {
    return {
      message: 'This endpoint includes beta features',
      betaFeatures: [
        'enhanced-search',
        'real-time-updates',
        'predictive-analytics'
      ],
      experimental: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Example endpoint with tenant-specific routing
   */
  @Get('tenant-specific')
  @TenantSpecific()
  @ApiOperation({ summary: 'Example of tenant-specific routing' })
  @ApiResponse({ status: 200, description: 'Returns tenant-specific response' })
  getTenantSpecificExample() {
    return {
      message: 'This endpoint provides tenant-specific content',
      tenantFeatures: ['custom-branding', 'tenant-analytics'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Example endpoint with rate limiting
   */
  @Post('rate-limited')
  @RateLimit(10, 60000) // 10 requests per minute
  @ApiOperation({ summary: 'Example of rate-limited endpoint' })
  @ApiResponse({ status: 200, description: 'Returns rate-limited response' })
  postRateLimitedExample(@Body() data: any) {
    return {
      message: 'This endpoint has custom rate limiting',
      received: data,
      rateLimit: {
        limit: 10,
        window: '1 minute'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Example endpoint with caching
   */
  @Get('cached')
  @CacheControl(3600, 'public, max-age=3600') // Cache for 1 hour
  @ApiOperation({ summary: 'Example of cached endpoint' })
  @ApiResponse({ status: 200, description: 'Returns cached response' })
  getCachedExample() {
    return {
      message: 'This endpoint response is cached',
      data: {
        staticContent: 'This content is cached for 1 hour',
        generatedAt: new Date().toISOString()
      },
      cacheInfo: {
        maxAge: 3600,
        cacheControl: 'public, max-age=3600'
      }
    };
  }

  /**
   * Example endpoint that bypasses routing
   */
  @Get('bypass-routing')
  @BypassRouting()
  @ApiOperation({ summary: 'Example of endpoint that bypasses routing' })
  @ApiResponse({ status: 200, description: 'Returns response without routing processing' })
  getBypassRoutingExample() {
    return {
      message: 'This endpoint bypasses all routing middleware',
      routing: {
        bypassed: true,
        reason: 'Uses @BypassRouting() decorator'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Example endpoint with custom routing metadata
   */
  @Get('custom-metadata')
  @RoutingMetadata({
    category: 'analytics',
    priority: 'high',
    customField: 'example-value'
  })
  @ApiOperation({ summary: 'Example of endpoint with custom routing metadata' })
  @ApiResponse({ status: 200, description: 'Returns response with custom metadata' })
  getCustomMetadataExample() {
    return {
      message: 'This endpoint has custom routing metadata',
      metadata: {
        category: 'analytics',
        priority: 'high',
        customField: 'example-value'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Example endpoint combining multiple routing features
   */
  @Get('combined-features')
  @ApiVersion('v2')
  @ClientType('web')
  @FeatureFlag('premium')
  @RateLimit(50, 60000)
  @CacheControl(1800)
  @RoutingMetadata({
    category: 'premium-features',
    requiresAuth: true
  })
  @ApiOperation({ summary: 'Example combining multiple routing features' })
  @ApiResponse({ status: 200, description: 'Returns response with combined routing features' })
  getCombinedFeaturesExample(@Query('format') format?: string) {
    return {
      message: 'This endpoint combines multiple routing features',
      features: {
        apiVersion: 'v2',
        clientType: 'web',
        featureFlag: 'premium',
        rateLimit: { limit: 50, window: '1 minute' },
        cache: { maxAge: 1800 },
        customMetadata: {
          category: 'premium-features',
          requiresAuth: true
        }
      },
      requestFormat: format,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Example endpoint for testing routing rules
   */
  @Post('test-routing')
  @ApiOperation({ summary: 'Test routing behavior with different parameters' })
  @ApiResponse({ status: 200, description: 'Returns routing test results' })
  postTestRoutingExample(
    @Body() testData: {
      headers?: Record<string, string>;
      query?: Record<string, any>;
      userRole?: string;
      clientType?: string;
    }
  ) {
    return {
      message: 'Routing test endpoint',
      testData,
      instructions: [
        'Send different headers to test header-based routing',
        'Include query parameters to test query-based routing',
        'Modify userRole to test role-based routing',
        'Change clientType to test client-specific routing'
      ],
      examples: {
        headers: {
          'x-api-version': 'v2',
          'x-client-type': 'mobile',
          'x-feature-flags': 'beta'
        },
        query: {
          beta: 'true',
          format: 'compact'
        },
        userRole: 'ADMIN',
        clientType: 'mobile'
      },
      timestamp: new Date().toISOString()
    };
  }
}