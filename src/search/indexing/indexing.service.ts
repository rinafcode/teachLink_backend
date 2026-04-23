import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { COURSES_INDEX, SEARCH_ANALYTICS_INDEX } from '../search.service';

@Injectable()
export class IndexingService implements OnModuleInit {
  private readonly logger = new Logger(IndexingService.name);

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async onModuleInit() {
    await this.ensureIndices();
  }

  // ── Generic document operations ─────────────────────────────────────────────

  async indexDocument(index: string, id: string, document: any) {
    return this.elasticsearchService.index({ index, id, document });
  }

  async updateDocument(index: string, id: string, document: any) {
    return this.elasticsearchService.update({ index, id, doc: document });
  }

  async deleteDocument(index: string, id: string) {
    return this.elasticsearchService.delete({ index, id });
  }

  async createIndex(index: string, mapping: any) {
    return this.elasticsearchService.indices.create({ index, mappings: mapping });
  }

  async bulkIndex(documents: any[]) {
    const operations = documents.flatMap((doc) => [
      { index: { _index: COURSES_INDEX, _id: String(doc.id) } },
      doc,
    ]);
    return this.elasticsearchService.bulk({ operations });
  }

  // ── Course-specific sync operations ─────────────────────────────────────────

  async syncCourse(course: Record<string, any>) {
    const { id, ...fields } = course;
    await this.elasticsearchService.index({
      index: COURSES_INDEX,
      id: String(id),
      document: { ...fields, updatedAt: new Date().toISOString() },
    });
  }

  async updateCourse(id: string, fields: Record<string, any>) {
    await this.elasticsearchService.update({
      index: COURSES_INDEX,
      id,
      doc: { ...fields, updatedAt: new Date().toISOString() },
    });
  }

  async removeCourse(id: string) {
    await this.elasticsearchService.delete({ index: COURSES_INDEX, id });
  }

  async reindexAll(courses: Array<Record<string, any>>) {
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

  private async ensureIndices() {
    await Promise.all([this.createCoursesIndex(), this.createSearchAnalyticsIndex()]);
  }

  async createCoursesIndex() {
    const exists = await this.elasticsearchService.indices.exists({ index: COURSES_INDEX });
    if (exists) return;

    this.logger.log(`Creating index: ${COURSES_INDEX}`);
    return this.elasticsearchService.indices.create({
      index: COURSES_INDEX,
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
    });
  }

  async createSearchAnalyticsIndex() {
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
