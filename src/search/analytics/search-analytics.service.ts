import { Injectable, Logger, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface SearchEvent {
  id: string;
  userId: string;
  sessionId: string;
  query: string;
  filters: Record<string, any>;
  results: string[];
  clickedResults: string[];
  timestamp: Date;
  responseTime: number;
  userAgent: string;
  ipAddress: string;
  source: 'web' | 'mobile' | 'api';
}

export interface SearchAnalytics {
  totalSearches: number;
  uniqueUsers: number;
  averageResponseTime: number;
  topQueries: Array<{ query: string; count: number }>;
  topFilters: Array<{ filter: string; count: number }>;
  clickThroughRate: number;
  zeroResultRate: number;
  popularContent: Array<{ contentId: string; clicks: number }>;
  timeDistribution: Record<string, number>;
  errorRate: number;
}

export interface PerformanceMetrics {
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  averageQueryLength: number;
  cacheHitRate: number;
  indexSize: number;
  searchErrors: number;
}

@Injectable()
export class SearchAnalyticsService {
  private readonly logger = new Logger(SearchAnalyticsService.name);
  private readonly searchIndex = 'search_analytics';
  private readonly performanceIndex = 'search_performance';
  private readonly errorIndex = 'search_errors';
  
  private readonly adminRoles = ['admin', 'analytics_admin'];
  private readonly allowedIps = new Set<string>();

  constructor(
    private readonly esService: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {
    this.initializeAllowedIps();
  }

  private initializeAllowedIps() {
    const allowedIpsConfig = this.configService.get<string>('ANALYTICS_ALLOWED_IPS', '');
    if (allowedIpsConfig) {
      allowedIpsConfig.split(',').forEach(ip => {
        this.allowedIps.add(ip.trim());
      });
    }
  }

  async logSearch(
    userId: string,
    query: string,
    filters: Record<string, any>,
    context: {
      sessionId?: string;
      userAgent?: string;
      ipAddress?: string;
      source?: 'web' | 'mobile' | 'api';
      responseTime?: number;
      results?: string[];
    } = {},
  ) {
    const startTime = Date.now();
    
    try {
      const searchEvent: SearchEvent = {
        id: this.generateEventId(),
        userId: userId || 'anonymous',
        sessionId: context.sessionId || this.generateSessionId(),
        query: query?.trim() || '',
        filters: filters || {},
        results: context.results || [],
        clickedResults: [],
        timestamp: new Date(),
        responseTime: context.responseTime || 0,
        userAgent: context.userAgent || 'unknown',
        ipAddress: context.ipAddress || 'unknown',
        source: context.source || 'web',
      };

      const { id, ...eventBody } = searchEvent;
      await this.esService.index({
        index: this.searchIndex,
        id,
        body: eventBody,
      });

      const duration = Date.now() - startTime;
      this.logger.debug(`Logged search event in ${duration}ms for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to log search event for user ${userId}`, error);
      // Don't throw error to avoid breaking search functionality
    }
  }

  async logClick(
    userId: string,
    resultId: string,
    context: {
      sessionId?: string;
      query?: string;
      position?: number;
      userAgent?: string;
      ipAddress?: string;
    } = {},
  ) {
    try {
      const clickEvent = {
        id: this.generateEventId(),
        userId: userId || 'anonymous',
        sessionId: context.sessionId || this.generateSessionId(),
        resultId,
        query: context.query || '',
        position: context.position || 0,
        timestamp: new Date(),
        userAgent: context.userAgent || 'unknown',
        ipAddress: context.ipAddress || 'unknown',
      };

      const { id: clickId, ...clickBody } = clickEvent;
      await this.esService.index({
        index: `${this.searchIndex}_clicks`,
        id: clickId,
        body: clickBody,
      });

      // Update the original search event with clicked results
      if (context.sessionId && context.query) {
        await this.updateSearchEventWithClick(context.sessionId, context.query, resultId);
      }

      this.logger.debug(`Logged click event for user ${userId} on result ${resultId}`);
    } catch (error) {
      this.logger.error(`Failed to log click event for user ${userId}`, error);
    }
  }

  async logError(
    error: Error,
    context: {
      userId?: string;
      query?: string;
      userAgent?: string;
      ipAddress?: string;
      stack?: string;
    } = {},
  ) {
    try {
      const errorEvent = {
        id: this.generateEventId(),
        userId: context.userId || 'unknown',
        query: context.query || '',
        error: error.message,
        stack: context.stack || error.stack,
        timestamp: new Date(),
        userAgent: context.userAgent || 'unknown',
        ipAddress: context.ipAddress || 'unknown',
      };

      const { id: errorId, ...errorBody } = errorEvent;
      await this.esService.index({
        index: this.errorIndex,
        id: errorId,
        body: errorBody,
      });

      this.logger.error(`Logged search error: ${error.message}`, error);
    } catch (logError) {
      this.logger.error('Failed to log error event', logError);
    }
  }

  async getAnalytics(
    timeRange: { from: Date; to: Date } = { from: new Date(Date.now() - 24 * 60 * 60 * 1000), to: new Date() },
    userRole?: string,
    userIp?: string,
  ): Promise<SearchAnalytics> {
    // Security check for analytics access
    if (!this.hasAnalyticsAccess(userRole, userIp)) {
      throw new UnauthorizedException('Access to analytics is restricted');
    }

    try {
      const [
        totalSearches,
        uniqueUsers,
        averageResponseTime,
        topQueries,
        topFilters,
        clickThroughRate,
        zeroResultRate,
        popularContent,
        timeDistribution,
        errorRate,
      ] = await Promise.all([
        this.getTotalSearches(timeRange),
        this.getUniqueUsers(timeRange),
        this.getAverageResponseTime(timeRange),
        this.getTopQueries(timeRange),
        this.getTopFilters(timeRange),
        this.getClickThroughRate(timeRange),
        this.getZeroResultRate(timeRange),
        this.getPopularContent(timeRange),
        this.getTimeDistribution(timeRange),
        this.getErrorRate(timeRange),
      ]);

      return {
        totalSearches,
        uniqueUsers,
        averageResponseTime,
        topQueries,
        topFilters,
        clickThroughRate,
        zeroResultRate,
        popularContent,
        timeDistribution,
        errorRate,
      };
    } catch (error) {
      this.logger.error('Failed to get analytics', error);
      throw new Error('Failed to retrieve analytics data');
    }
  }

  async getPerformanceMetrics(timeRange: { from: Date; to: Date }): Promise<PerformanceMetrics> {
    try {
      const [
        responseTimePercentiles,
        averageQueryLength,
        cacheHitRate,
        indexSize,
        searchErrors,
      ] = await Promise.all([
        this.getResponseTimePercentiles(timeRange),
        this.getAverageQueryLength(timeRange),
        this.getCacheHitRate(timeRange),
        this.getIndexSize(),
        this.getSearchErrorCount(timeRange),
      ]);

      return {
        p50ResponseTime: responseTimePercentiles.p50,
        p95ResponseTime: responseTimePercentiles.p95,
        p99ResponseTime: responseTimePercentiles.p99,
        averageQueryLength,
        cacheHitRate,
        indexSize,
        searchErrors,
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics', error);
      throw new Error('Failed to retrieve performance metrics');
    }
  }

  private hasAnalyticsAccess(userRole?: string, userIp?: string): boolean {
    // Check if user has admin role
    if (userRole && this.adminRoles.includes(userRole)) {
      return true;
    }

    // Check if IP is in allowed list
    if (userIp && this.allowedIps.has(userIp)) {
      return true;
    }

    // Check environment variable for public access
    const publicAccess = this.configService.get<boolean>('ANALYTICS_PUBLIC_ACCESS', false);
    return publicAccess;
  }

  private async getTotalSearches(timeRange: { from: Date; to: Date }): Promise<number> {
    const result = await this.esService.count({
      index: this.searchIndex,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
      } as any,
    });

    return result.count;
  }

  private async getUniqueUsers(timeRange: { from: Date; to: Date }): Promise<number> {
    const result = await this.esService.search({
      index: this.searchIndex,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
        aggs: {
          unique_users: {
            cardinality: { field: 'userId' },
          },
        },
        size: 0,
      } as any,
    });
    const aggs = result.aggregations as any;
    return aggs?.unique_users?.value || 0;
  }

  private async getAverageResponseTime(timeRange: { from: Date; to: Date }): Promise<number> {
    const result = await this.esService.search({
      index: this.searchIndex,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
        aggs: {
          avg_response_time: {
            avg: { field: 'responseTime' },
          },
        },
        size: 0,
      } as any,
    });
    const aggs2 = result.aggregations as any;
    return aggs2?.avg_response_time?.value || 0;
  }

  private async getTopQueries(timeRange: { from: Date; to: Date }): Promise<Array<{ query: string; count: number }>> {
    const result = await this.esService.search({
      index: this.searchIndex,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
        aggs: {
          top_queries: {
            terms: {
              field: 'query.keyword',
              size: 10,
            },
          },
        },
        size: 0,
      } as any,
    });
    const aggs3 = result.aggregations as any;
    return aggs3?.top_queries?.buckets?.map((bucket: any) => ({
      query: bucket.key,
      count: bucket.doc_count,
    })) || [];
  }

  private async getTopFilters(timeRange: { from: Date; to: Date }): Promise<Array<{ filter: string; count: number }>> {
    const result = await this.esService.search({
      index: this.searchIndex,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
        aggs: {
          top_filters: {
            nested: { path: 'filters' },
            aggs: {
              filter_keys: {
                terms: { field: 'filters.key' },
              },
            },
          },
        },
        size: 0,
      } as any,
    });
    const aggs4 = result.aggregations as any;
    return aggs4?.top_filters?.filter_keys?.buckets?.map((bucket: any) => ({
      filter: bucket.key,
      count: bucket.doc_count,
    })) || [];
  }

  private async getClickThroughRate(timeRange: { from: Date; to: Date }): Promise<number> {
    const [totalSearches, totalClicks] = await Promise.all([
      this.getTotalSearches(timeRange),
      this.getTotalClicks(timeRange),
    ]);

    return totalSearches > 0 ? totalClicks / totalSearches : 0;
  }

  private async getZeroResultRate(timeRange: { from: Date; to: Date }): Promise<number> {
    const result = await this.esService.search({
      index: this.searchIndex,
      body: {
        query: {
          bool: {
            must: [
              {
                range: {
                  timestamp: {
                    gte: timeRange.from.toISOString(),
                    lte: timeRange.to.toISOString(),
                  },
                },
              },
              {
                script: {
                  script: 'doc["results"].size() == 0',
                },
              },
            ],
          },
        },
        aggs: {
          zero_results: {
            value_count: { field: 'id' },
          },
        },
        size: 0,
      } as any,
    });

    const aggs5 = result.aggregations as any;
    const zeroResults = aggs5?.zero_results?.value || 0;
    const totalSearches = await this.getTotalSearches(timeRange);

    return totalSearches > 0 ? zeroResults / totalSearches : 0;
  }

  private async getPopularContent(timeRange: { from: Date; to: Date }): Promise<Array<{ contentId: string; clicks: number }>> {
    const result = await this.esService.search({
      index: `${this.searchIndex}_clicks`,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
        aggs: {
          popular_content: {
            terms: {
              field: 'resultId.keyword',
              size: 10,
            },
          },
        },
        size: 0,
      } as any,
    });

    const aggs6 = result.aggregations as any;
    return aggs6?.popular_content?.buckets?.map((bucket: any) => ({
      contentId: bucket.key,
      clicks: bucket.doc_count,
    })) || [];
  }

  private async getTimeDistribution(timeRange: { from: Date; to: Date }): Promise<Record<string, number>> {
    const result = await this.esService.search({
      index: this.searchIndex,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
        aggs: {
          hourly_distribution: {
            date_histogram: {
              field: 'timestamp',
              calendar_interval: 'hour',
            },
          },
        },
        size: 0,
      } as any,
    });

    const distribution: Record<string, number> = {};
    const aggs7 = result.aggregations as any;
    aggs7?.hourly_distribution?.buckets?.forEach((bucket: any) => {
      distribution[bucket.key_as_string] = bucket.doc_count;
    });

    return distribution;
  }

  private async getErrorRate(timeRange: { from: Date; to: Date }): Promise<number> {
    const [totalSearches, totalErrors] = await Promise.all([
      this.getTotalSearches(timeRange),
      this.getSearchErrorCount(timeRange),
    ]);

    return totalSearches > 0 ? totalErrors / totalSearches : 0;
  }

  private async getResponseTimePercentiles(timeRange: { from: Date; to: Date }) {
    const result = await this.esService.search({
      index: this.searchIndex,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
        aggs: {
          response_time_percentiles: {
            percentiles: {
              field: 'responseTime',
              percents: [50, 95, 99],
            },
          },
        },
        size: 0,
      } as any,
    });

    const percentiles = result.aggregations as any;
    return {
      p50: percentiles['50.0'] || 0,
      p95: percentiles['95.0'] || 0,
      p99: percentiles['99.0'] || 0,
    };
  }

  private async getAverageQueryLength(timeRange: { from: Date; to: Date }): Promise<number> {
    const result = await this.esService.search({
      index: this.searchIndex,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
        aggs: {
          avg_query_length: {
            avg: {
              script: {
                source: 'doc["query.keyword"].value.length()',
              },
            },
          },
        },
        size: 0,
      } as any,
    });

    const aggs9 = result.aggregations as any;
    return aggs9?.avg_query_length?.value || 0;
  }

  private async getCacheHitRate(timeRange: { from: Date; to: Date }): Promise<number> {
    // This would need to be implemented based on your caching strategy
    // For now, return a placeholder value
    return 0.85;
  }

  private async getIndexSize(): Promise<number> {
    const result = await this.esService.indices.stats({
      index: this.searchIndex,
    });

    return result.indices[this.searchIndex]?.total?.store?.size_in_bytes || 0;
  }

  private async getSearchErrorCount(timeRange: { from: Date; to: Date }): Promise<number> {
    const result = await this.esService.count({
      index: this.errorIndex,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
      } as any,
    });

    return result.count;
  }

  private async getTotalClicks(timeRange: { from: Date; to: Date }): Promise<number> {
    const result = await this.esService.count({
      index: `${this.searchIndex}_clicks`,
      body: {
        query: {
          range: {
            timestamp: {
              gte: timeRange.from.toISOString(),
              lte: timeRange.to.toISOString(),
            },
          },
        },
      } as any,
    });

    return result.count;
  }

  private async updateSearchEventWithClick(sessionId: string, query: string, resultId: string) {
    try {
      await this.esService.updateByQuery({
        index: this.searchIndex,
        body: {
          query: {
            bool: {
              must: [
                { term: { sessionId } },
                { term: { query } },
              ],
            },
          },
          script: {
            source: 'ctx._source.clickedResults.add(params.resultId)',
            lang: 'painless',
            params: { resultId },
          },
        } as any,
      });
    } catch (error) {
      this.logger.error(`Failed to update search event with click for session ${sessionId}, query ${query}`, error);
    }
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substr(2, 15);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldData() {
    try {
      const retentionDays = this.configService.get<number>('ANALYTICS_RETENTION_DAYS', 90);
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // Clean up old search events
      await this.esService.deleteByQuery({
        index: this.searchIndex,
        body: {
          query: {
            range: {
              timestamp: {
                lt: cutoffDate.toISOString(),
              },
            },
          },
        },
      } as unknown as import('@elastic/elasticsearch/lib/api/types').DeleteByQueryRequest);

      // Clean up old click events
      await this.esService.deleteByQuery({
        index: `${this.searchIndex}_clicks`,
        body: {
          query: {
            range: {
              timestamp: {
                lt: cutoffDate.toISOString(),
              },
            },
          },
        },
      } as unknown as import('@elastic/elasticsearch/lib/api/types').DeleteByQueryRequest);

      // Clean up old error events
      await this.esService.deleteByQuery({
        index: this.errorIndex,
        body: {
          query: {
            range: {
              timestamp: {
                lt: cutoffDate.toISOString(),
              },
            },
          },
        },
      } as unknown as import('@elastic/elasticsearch/lib/api/types').DeleteByQueryRequest);

      this.logger.log(`Cleaned up analytics data older than ${retentionDays} days`);
    } catch (error) {
      this.logger.error('Failed to cleanup old analytics data', error);
    }
  }
} 