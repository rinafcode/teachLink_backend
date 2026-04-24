import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CachingService } from './caching.service';
import { CacheAnalyticsService } from './analytics/cache-analytics.service';
import { CacheInvalidationService } from './invalidation/invalidation.service';
import { CacheWarmingService } from './warming/cache-warming.service';
import { CacheStrategiesService } from './strategies/cache-strategies.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

/**
 * Exposes cache Management endpoints.
 */
@ApiTags('Cache Management')
@ApiBearerAuth()
@Controller('cache')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class CacheManagementController {
  constructor(
    private readonly cachingService: CachingService,
    private readonly analyticsService: CacheAnalyticsService,
    private readonly invalidationService: CacheInvalidationService,
    private readonly warmingService: CacheWarmingService,
    private readonly strategiesService: CacheStrategiesService,
  ) {}

  /**
   * Returns stats.
   * @returns The operation result.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get cache statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns cache statistics including hit/miss rates and memory usage',
  })
  async getStats() {
    const [redisStats, analyticsSummary, warmingStats, invalidationStats] = await Promise.all([
      this.cachingService.getStats(),
      this.analyticsService.getSummary(),
      this.warmingService.getStats(),
      this.invalidationService.getStats(),
    ]);

    return {
      redis: redisStats,
      analytics: {
        totalHits: analyticsSummary.totalHits,
        totalMisses: analyticsSummary.totalMisses,
        hitRate: `${analyticsSummary.hitRate}%`,
        missRate: `${analyticsSummary.missRate}%`,
        totalKeys: analyticsSummary.totalKeys,
        memoryUsage: analyticsSummary.memoryUsage,
        topKeys: analyticsSummary.topKeys,
      },
      warming: warmingStats,
      invalidation: invalidationStats,
    };
  }

  /**
   * Returns analytics.
   * @returns The operation result.
   */
  @Get('analytics')
  @ApiOperation({ summary: 'Get detailed cache analytics' })
  @ApiResponse({
    status: 200,
    description: 'Returns detailed cache analytics including metrics per key',
  })
  async getAnalytics() {
    const summary = await this.analyticsService.getSummary();
    const allMetrics = this.analyticsService.getAllMetrics();

    return {
      summary: {
        totalHits: summary.totalHits,
        totalMisses: summary.totalMisses,
        hitRate: summary.hitRate,
        missRate: summary.missRate,
      },
      metrics: allMetrics,
      patternStats: Object.fromEntries(summary.patternStats),
    };
  }

  /**
   * Returns prometheus Metrics.
   * @returns The operation result.
   */
  @Get('metrics/prometheus')
  @ApiOperation({ summary: 'Get Prometheus-compatible metrics' })
  @ApiResponse({
    status: 200,
    description: 'Returns metrics in Prometheus format',
  })
  getPrometheusMetrics() {
    return this.analyticsService.getPrometheusMetrics();
  }

  /**
   * Returns strategies.
   * @returns The operation result.
   */
  @Get('strategies')
  @ApiOperation({ summary: 'Get all cache strategies' })
  @ApiResponse({
    status: 200,
    description: 'Returns all registered cache strategies',
  })
  getStrategies() {
    return {
      strategies: this.strategiesService.getAllStrategies(),
      ttlConstants: this.cachingService.getTTLConstants(),
    };
  }

  /**
   * Returns warmed Keys.
   * @returns The operation result.
   */
  @Get('warmed')
  @ApiOperation({ summary: 'Get warmed cache keys' })
  @ApiResponse({
    status: 200,
    description: 'Returns all keys that have been warmed',
  })
  getWarmedKeys() {
    return {
      stats: this.warmingService.getStats(),
      keys: this.warmingService.getWarmedKeys(),
    };
  }

  /**
   * Returns key.
   * @param key The key.
   * @returns The operation result.
   */
  @Get('key/:key')
  @ApiOperation({ summary: 'Get a cached value by key' })
  @ApiParam({ name: 'key', description: 'Cache key to retrieve' })
  @ApiResponse({
    status: 200,
    description: 'Returns the cached value',
  })
  @ApiResponse({
    status: 404,
    description: 'Key not found in cache',
  })
  async getKey(@Param('key') key: string) {
    const value = await this.cachingService.get(key);
    const ttl = await this.cachingService.getTtl(key);

    return {
      key,
      value,
      ttl,
      exists: value !== null,
    };
  }

  /**
   * Clears all.
   * @returns The operation result.
   */
  @Delete('clear')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear all cache' })
  @ApiResponse({
    status: 204,
    description: 'All cache cleared successfully',
  })
  async clearAll() {
    await this.cachingService.clearAll();
  }

  /**
   * Clears by Pattern.
   * @param pattern The pattern.
   * @returns The operation result.
   */
  @Delete('clear/:pattern')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear cache by pattern' })
  @ApiParam({ name: 'pattern', description: 'Pattern to match (use * as wildcard)' })
  @ApiResponse({
    status: 204,
    description: 'Cache entries matching pattern cleared successfully',
  })
  async clearByPattern(@Param('pattern') pattern: string) {
    // Decode URL-encoded pattern
    const decodedPattern = decodeURIComponent(pattern);
    await this.cachingService.delPattern(`cache:${decodedPattern}`);
  }

  /**
   * Invalidates course.
   * @param courseId The course identifier.
   * @returns The operation result.
   */
  @Delete('invalidate/course/:courseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidate all cache for a specific course' })
  @ApiParam({ name: 'courseId', description: 'Course ID to invalidate cache for' })
  @ApiResponse({
    status: 204,
    description: 'Course cache invalidated successfully',
  })
  async invalidateCourse(@Param('courseId') courseId: string) {
    await this.invalidationService.invalidateCourse(courseId);
  }

  /**
   * Invalidates user.
   * @param userId The user identifier.
   * @returns The operation result.
   */
  @Delete('invalidate/user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidate all cache for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID to invalidate cache for' })
  @ApiResponse({
    status: 204,
    description: 'User cache invalidated successfully',
  })
  async invalidateUser(@Param('userId') userId: string) {
    await this.invalidationService.invalidateUser(userId);
  }

  /**
   * Invalidates search.
   * @returns The operation result.
   */
  @Delete('invalidate/search')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidate all search cache' })
  @ApiResponse({
    status: 204,
    description: 'Search cache invalidated successfully',
  })
  async invalidateSearch() {
    await this.invalidationService.invalidateSearch();
  }

  /**
   * Warms cache.
   * @returns The operation result.
   */
  @Post('warm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger cache warming' })
  @ApiResponse({
    status: 200,
    description: 'Cache warming triggered successfully',
  })
  async warmCache() {
    await this.warmingService.refreshAll();
    return {
      message: 'Cache warming completed',
      stats: this.warmingService.getStats(),
    };
  }

  /**
   * Resets analytics.
   * @param pattern The pattern.
   * @returns The operation result.
   */
  @Post('analytics/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset analytics metrics' })
  @ApiResponse({
    status: 200,
    description: 'Analytics metrics reset successfully',
  })
  async resetAnalytics(@Query('pattern') pattern?: string) {
    if (pattern) {
      this.analyticsService.resetPatternMetrics(pattern);
    } else {
      this.analyticsService.resetMetrics();
    }

    return {
      message: pattern ? `Analytics reset for pattern: ${pattern}` : 'All analytics reset',
    };
  }
}
