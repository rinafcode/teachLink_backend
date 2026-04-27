import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { COURSES_INDEX } from '../search.service';

export interface IIndexOptimizationConfig {
  numberOfShards: number;
  numberOfReplicas: number;
  refreshInterval: string;
  maxResultWindow: number;
}

@Injectable()
export class SearchIndexOptimizerService {
  private readonly logger = new Logger(SearchIndexOptimizerService.name);

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  /**
   * Optimize search index settings for better performance
   */
  async optimizeIndexSettings(): Promise<void> {
    try {
      const indexExists = await this.elasticsearchService.indices.exists({
        index: COURSES_INDEX,
      });

      if (!indexExists) {
        this.logger.warn(`Index ${COURSES_INDEX} does not exist. Creating optimized index...`);
        await this.createOptimizedIndex();
        return;
      }

      this.logger.log(`Optimizing existing index ${COURSES_INDEX}...`);
      await this.updateIndexSettings();
    } catch (error) {
      this.logger.error(`Failed to optimize index: ${error.message}`);
    }
  }

  /**
   * Create index with optimized settings
   */
  private async createOptimizedIndex(): Promise<void> {
    const optimizedSettings: IIndexOptimizationConfig = {
      numberOfShards: 3,
      numberOfReplicas: 1,
      refreshInterval: '5s',
      maxResultWindow: 10000,
    };

    await this.elasticsearchService.indices.create({
      index: COURSES_INDEX,
      body: {
        settings: {
          number_of_shards: optimizedSettings.numberOfShards,
          number_of_replicas: optimizedSettings.numberOfReplicas,
          refresh_interval: optimizedSettings.refreshInterval,
          max_result_window: optimizedSettings.maxResultWindow,
          'analysis.analyzer.default.type': 'standard',
          'analysis.analyzer.default.stopwords': '_english_',
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            title: {
              type: 'text',
              analyzer: 'standard',
              fields: {
                keyword: { type: 'keyword' },
                search: {
                  type: 'search_as_you_type',
                  doc_values: false,
                },
              },
            },
            description: {
              type: 'text',
              analyzer: 'standard',
            },
            tags: { type: 'keyword' },
            category: { type: 'keyword' },
            level: { type: 'keyword' },
            language: { type: 'keyword' },
            price: { type: 'float' },
            rating: { type: 'float' },
            views: { type: 'integer' },
            enrollments: { type: 'integer' },
            duration: { type: 'integer' },
            instructorId: { type: 'keyword' },
            instructorName: { type: 'text' },
            status: { type: 'keyword' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      },
    });

    this.logger.log(`Created optimized index ${COURSES_INDEX}`);
  }

  /**
   * Update existing index settings (only dynamic settings can be updated)
   */
  private async updateIndexSettings(): Promise<void> {
    const dynamicSettings = {
      'index.refresh_interval': '5s',
      'index.max_result_window': 10000,
    };

    await this.elasticsearchService.indices.putSettings({
      index: COURSES_INDEX,
      body: dynamicSettings,
    });

    this.logger.log('Updated index settings for better performance');
  }

  /**
   * Force merge index segments for faster searches (read-only operation)
   */
  async forceMergeIndex(): Promise<void> {
    try {
      await this.elasticsearchService.indices.forcemerge({
        index: COURSES_INDEX,
        max_num_segments: 1,
      });
      this.logger.log('Force merge completed for faster searches');
    } catch (error) {
      this.logger.error(`Force merge failed: ${error.message}`);
    }
  }

  /**
   * Refresh index to make recent changes searchable
   */
  async refreshIndex(): Promise<void> {
    try {
      await this.elasticsearchService.indices.refresh({
        index: COURSES_INDEX,
      });
      this.logger.log('Index refreshed successfully');
    } catch (error) {
      this.logger.error(`Index refresh failed: ${error.message}`);
    }
  }

  /**
   * Get index statistics for monitoring
   */
  async getIndexStats(): Promise<any> {
    try {
      const stats = await this.elasticsearchService.indices.stats({
        index: COURSES_INDEX,
      });

      const indexStats = stats._indices?.[COURSES_INDEX];
      if (!indexStats) {
        return null;
      }

      return {
        docsCount: indexStats.primaries.docs?.count || 0,
        storeSize: indexStats.primaries.store?.size_in_bytes || 0,
        searchStats: {
          queryTotal: indexStats.primaries.search?.query_total || 0,
          queryTimeInMs: indexStats.primaries.search?.query_time_in_millis || 0,
          fetchTotal: indexStats.primaries.search?.fetch_total || 0,
          fetchTimeInMs: indexStats.primaries.search?.fetch_time_in_millis || 0,
        },
        indexingStats: {
          indexTotal: indexStats.primaries.indexing?.index_total || 0,
          indexTimeInMs: indexStats.primaries.indexing?.index_time_in_millis || 0,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get index stats: ${error.message}`);
      return null;
    }
  }

  /**
   * Optimize query performance with query profiling
   */
  async profileSearchQuery(query: any): Promise<any> {
    try {
      const result = await this.elasticsearchService.search({
        index: COURSES_INDEX,
        body: {
          profile: true,
          ...query,
        },
      });

      return {
        results: result.hits,
        profiling: result.profile,
      };
    } catch (error) {
      this.logger.error(`Query profiling failed: ${error.message}`);
      return null;
    }
  }
}
