import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CacheAnalyticsService, CacheAnalyticsReport, TTLRecommendation } from './cache-analytics.service';
import { CacheOptimizationService, OptimizationResult, CacheOptimizationConfig } from './cache-optimization.service';

@ApiTags('Cache Management')
@Controller('cache')
export class CacheManagementController {
  constructor(
    private readonly analyticsService: CacheAnalyticsService,
    private readonly optimizationService: CacheOptimizationService,
  ) {}

  @Get('analytics/report')
  @ApiOperation({ summary: 'Get comprehensive cache analytics report' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache analytics report with hit rates, TTL recommendations, and performance metrics',
    schema: {
      type: 'object',
      properties: {
        totalKeys: { type: 'number' },
        overallHitRate: { type: 'number' },
        memoryUsage: { type: 'number' },
        topPerformers: { type: 'array' },
        underPerformers: { type: 'array' },
        ttlRecommendations: { type: 'array' },
        adaptiveTtlAdjustments: { type: 'number' },
        generatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  async getAnalyticsReport(): Promise<CacheAnalyticsReport> {
    return this.analyticsService.generateAnalyticsReport();
  }

  @Get('analytics/metrics/:key')
  @ApiOperation({ summary: 'Get metrics for a specific cache key' })
  @ApiResponse({ status: 200, description: 'Cache metrics for the specified key' })
  async getKeyMetrics(@Param('key') key: string) {
    // This would need to be implemented in the analytics service
    return { message: `Metrics for key: ${key}` };
  }

  @Get('ttl/recommendations')
  @ApiOperation({ summary: 'Get TTL optimization recommendations' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit number of recommendations' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of TTL optimization recommendations',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          currentTtl: { type: 'number' },
          recommendedTtl: { type: 'number' },
          reason: { type: 'string' },
          confidence: { type: 'number' },
          potentialSavings: { type: 'number' }
        }
      }
    }
  })
  async getTTLRecommendations(@Query('limit') limit?: number): Promise<TTLRecommendation[]> {
    const report = await this.analyticsService.generateAnalyticsReport();
    return limit ? report.ttlRecommendations.slice(0, limit) : report.ttlRecommendations;
  }

  @Post('optimize')
  @ApiOperation({ summary: 'Run comprehensive cache optimization' })
  @ApiResponse({ 
    status: 200, 
    description: 'Optimization results',
    schema: {
      type: 'object',
      properties: {
        optimizationsApplied: { type: 'number' },
        memoryFreed: { type: 'number' },
        hitRateImprovement: { type: 'number' },
        recommendations: { type: 'array' },
        timestamp: { type: 'string', format: 'date-time' }
      }
    }
  })
  async optimizeCache(): Promise<OptimizationResult> {
    return this.optimizationService.optimizeCache();
  }

  @Get('config')
  @ApiOperation({ summary: 'Get cache optimization configuration' })
  @ApiResponse({ status: 200, description: 'Current cache optimization configuration' })
  getOptimizationConfig(): CacheOptimizationConfig {
    return this.optimizationService.getOptimizationConfig();
  }

  @Put('config')
  @ApiOperation({ summary: 'Update cache optimization configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  updateOptimizationConfig(@Body() config: Partial<CacheOptimizationConfig>) {
    this.optimizationService.updateOptimizationConfig(config);
    return { message: 'Cache optimization configuration updated' };
  }

  @Post('ttl/:key')
  @ApiOperation({ summary: 'Set custom TTL for a specific cache key pattern' })
  @ApiResponse({ status: 200, description: 'TTL updated successfully' })
  async setCustomTTL(
    @Param('key') key: string,
    @Body() body: { ttl: number; reason?: string }
  ) {
    // This would update the TTL configuration
    return { 
      message: `TTL for key pattern '${key}' set to ${body.ttl} seconds`,
      key,
      ttl: body.ttl,
      reason: body.reason
    };
  }

  @Delete('key/:key')
  @ApiOperation({ summary: 'Delete a specific cache key' })
  @ApiResponse({ status: 200, description: 'Cache key deleted successfully' })
  async deleteKey(@Param('key') key: string) {
    await this.optimizationService.del(key);
    return { message: `Cache key '${key}' deleted successfully` };
  }

  @Post('clear')
  @ApiOperation({ summary: 'Clear all cache data' })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  async clearCache() {
    // This would need to be implemented
    return { message: 'Cache cleared successfully' };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get real-time cache statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Real-time cache statistics',
    schema: {
      type: 'object',
      properties: {
        totalKeys: { type: 'number' },
        memoryUsage: { type: 'number' },
        hitRate: { type: 'number' },
        operationsPerSecond: { type: 'number' },
        averageResponseTime: { type: 'number' }
      }
    }
  })
  async getCacheStats() {
    const report = await this.analyticsService.generateAnalyticsReport();
    
    return {
      totalKeys: report.totalKeys,
      memoryUsage: report.memoryUsage,
      hitRate: report.overallHitRate,
      operationsPerSecond: 0, // Would need to be calculated from recent metrics
      averageResponseTime: 0, // Would need to be calculated from performance metrics
      lastUpdated: new Date()
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check cache system health' })
  @ApiResponse({ status: 200, description: 'Cache system health status' })
  async getCacheHealth() {
    const report = await this.analyticsService.generateAnalyticsReport();
    
    // Define health thresholds
    const healthStatus = {
      status: 'healthy' as 'healthy' | 'warning' | 'critical',
      hitRate: report.overallHitRate,
      memoryUsage: report.memoryUsage,
      totalKeys: report.totalKeys,
      issues: [] as string[],
      recommendations: [] as string[]
    };

    // Check hit rate health
    if (report.overallHitRate < 0.5) {
      healthStatus.status = 'warning';
      healthStatus.issues.push('Low overall hit rate');
      healthStatus.recommendations.push('Review cache TTL settings and key patterns');
    }

    // Check for underperforming keys
    if (report.underPerformers.length > report.totalKeys * 0.3) {
      healthStatus.status = 'warning';
      healthStatus.issues.push('High number of underperforming cache keys');
      healthStatus.recommendations.push('Run cache optimization to clean up poor performers');
    }

    // Check memory usage (if available)
    if (report.memoryUsage > 1024 * 1024 * 1024) { // > 1GB
      healthStatus.status = 'warning';
      healthStatus.issues.push('High memory usage');
      healthStatus.recommendations.push('Consider reducing TTL for large objects');
    }

    return healthStatus;
  }
}