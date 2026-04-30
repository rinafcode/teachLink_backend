import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { COURSES_INDEX, SEARCH_ANALYTICS_INDEX } from '../search.service';

/**
 * Provides indexing operations.
 */
@Injectable()
export class IndexingService implements OnModuleInit {
  private readonly logger = new Logger(IndexingService.name);
  private readonly reindexOnBoot = process.env.SEARCH_REINDEX_ON_BOOT === 'true';

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureIndices();
  }

  // ── Generic document operations ─────────────────────────────────────────────

  async indexDocument(index: string, id: string, document: any): Promise<any> {
    return this.elasticsearchService.index({ index, id, document });
  }

  async updateDocument(index: string, id: string, document: any): Promise<any> {
    return this.elasticsearchService.update({ index, id, doc: document });
  }

  async deleteDocument(index: string, id: string): Promise<any> {
    return this.elasticsearchService.delete({ index, id });
  }

  async createIndex(index: string, mapping: any): Promise<any> {
    return this.elasticsearchService.indices.create({ index, mappings: mapping });
  }

  async bulkIndex(documents: any[]): Promise<any> {
    const operations = documents.flatMap((doc) => [
      { index: { _index: COURSES_INDEX, _id: String(doc.id) } },
      doc,
    ]);
    return this.elasticsearchService.bulk({ operations });
  }

  // ── Course-specific sync operations ─────────────────────────────────────────

  async syncCourse(course: Record<string, any>): Promise<void> {
    const { id, ...fields } = course;
    await this.elasticsearchService.index({
      index: COURSES_INDEX,
      id: String(id),
      document: { ...fields, updatedAt: new Date().toISOString() },
    });
  }

  async updateCourse(id: string, fields: Record<string, any>): Promise<void> {
    await this.elasticsearchService.update({
      index: COURSES_INDEX,
      id,
      doc: { ...fields, updatedAt: new Date().toISOString() },
    });
  }

  async removeCourse(id: string): Promise<void> {
    await this.elasticsearchService.delete({ index: COURSES_INDEX, id });
  }

  async reindexAll(courses: Array<Record<string, any>>): Promise<any> {
    if (courses.length === 0) return;

    const operations = courses.flatMap((course) => {
      const { id, ...fields } = course;
      return [
        { index: { _index: COURSES_INDEX, _id: String(id) } },
        { ...fields, updatedAt: new Date().toISOString() },
      ];
    });

    const result = await this.elasticsearchService.bulk({ operations });
    if (result.errors) {
      const failed = result.items.filter((item: any) => item.index?.error);
      this.logger.error(`Bulk reindex had ${failed.length} failures`);
    }
    return result;
  }

  // ── Index bootstrap ──────────────────────────────────────────────────────────

  private async ensureIndices(): Promise<void> {
    await Promise.all([
      this.createCoursesIndex(this.reindexOnBoot),
      this.createSearchAnalyticsIndex(),
    ]);
  }

  async createCoursesIndex(forceReindex = false): Promise<any> {
    const exists = await this.elasticsearchService.indices.exists({ index: COURSES_INDEX });

    if (exists) {
      await this.ensureExistingCoursesIndexSettings();
      if (forceReindex) {
        await this.reindexCoursesIndexWithCurrentMapping();
      }
      return;
    }

    this.logger.log(`Creating index: ${COURSES_INDEX}`);
    return this.elasticsearchService.indices.create({
      index: COURSES_INDEX,
      ...this.getCoursesIndexDefinition(),
    });
  }

  private async ensureExistingCoursesIndexSettings(): Promise<void> {
    try {
      await this.elasticsearchService.indices.putSettings({
        index: COURSES_INDEX,
        settings: {
          refresh_interval: '30s',
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to update settings for ${COURSES_INDEX}: ${String(error)}`);
    }
  }

  private async reindexCoursesIndexWithCurrentMapping(): Promise<void> {
    const tempIndex = `${COURSES_INDEX}_tmp_${Date.now()}`;
    this.logger.log(
      `SEARCH_REINDEX_ON_BOOT enabled, reindexing ${COURSES_INDEX} using temporary index ${tempIndex}`,
    );

    try {
      await this.elasticsearchService.indices.create({
        index: tempIndex,
        ...this.getCoursesIndexDefinition(),
      });

      const sourceCount = await this.elasticsearchService.count({ index: COURSES_INDEX });
      if (sourceCount.count > 0) {
        await this.elasticsearchService.reindex({
          wait_for_completion: true,
          refresh: true,
          source: { index: COURSES_INDEX },
          dest: { index: tempIndex },
        });
      }

      await this.elasticsearchService.indices.delete({ index: COURSES_INDEX });
      await this.elasticsearchService.indices.create({
        index: COURSES_INDEX,
        ...this.getCoursesIndexDefinition(),
      });

      const tempCount = await this.elasticsearchService.count({ index: tempIndex });
      if (tempCount.count > 0) {
        await this.elasticsearchService.reindex({
          wait_for_completion: true,
          refresh: true,
          source: { index: tempIndex },
          dest: { index: COURSES_INDEX },
        });
      }

      this.logger.log(`Reindex completed successfully for ${COURSES_INDEX}`);
    } catch (error) {
      this.logger.error(`Failed to reindex ${COURSES_INDEX}: ${String(error)}`);
      throw error;
    } finally {
      const tempExists = await this.elasticsearchService.indices.exists({ index: tempIndex });
      if (tempExists) {
        await this.elasticsearchService.indices.delete({ index: tempIndex });
      }
    }
  }

  private getCoursesIndexDefinition() {
    return {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 1,
        refresh_interval: '30s',
        analysis: {
          analyzer: {
            english_custom: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'english_stop', 'english_stemmer'],
            },
          },
          normalizer: {
            lowercase_normalizer: {
              type: 'custom',
              filter: ['lowercase'],
            },
          },
          filter: {
            english_stop: { type: 'stop', stopwords: '_english_' },
            english_stemmer: { type: 'stemmer', language: 'english' },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          title: {
            type: 'text',
            analyzer: 'english_custom',
            fields: {
              keyword: { type: 'keyword' },
              suggest: { type: 'completion' },
              search: { type: 'search_as_you_type' },
            },
          },
          description: { type: 'text', analyzer: 'english_custom' },
          content: { type: 'text', analyzer: 'english_custom' },
          tags: { type: 'keyword', normalizer: 'lowercase_normalizer' },
          category: { type: 'keyword', normalizer: 'lowercase_normalizer' },
          level: { type: 'keyword', normalizer: 'lowercase_normalizer' },
          language: { type: 'keyword', normalizer: 'lowercase_normalizer' },
          price: { type: 'float' },
          rating: { type: 'float' },
          views: { type: 'integer' },
          enrollments: { type: 'integer' },
          duration: { type: 'integer' },
          instructorId: { type: 'keyword' },
          instructorName: {
            type: 'text',
            fields: { keyword: { type: 'keyword' } },
          },
          status: { type: 'keyword' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
        },
      },
    };
  }

  async createSearchAnalyticsIndex(): Promise<any> {
    const exists = await this.elasticsearchService.indices.exists({
      index: SEARCH_ANALYTICS_INDEX,
    });
    if (exists) return;

    this.logger.log(`Creating index: ${SEARCH_ANALYTICS_INDEX}`);
    return this.elasticsearchService.indices.create({
      index: SEARCH_ANALYTICS_INDEX,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 1,
      },
      mappings: {
        properties: {
          query: { type: 'keyword' },
          resultsCount: { type: 'integer' },
          filters: { type: 'object', enabled: false },
          sort: { type: 'keyword' },
          timestamp: { type: 'date' },
        },
      },
    });
  }
}
