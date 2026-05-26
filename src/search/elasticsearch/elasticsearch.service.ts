import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);

  private readonly indices = {
    courses: 'courses',
    analytics: 'search_analytics',
  };

  constructor(private readonly elasticsearch: NestElasticsearchService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureCoursesIndex();
    await this.ensureAnalyticsIndex();
  }

  private async ensureCoursesIndex(): Promise<void> {
    const exists = await this.elasticsearch.indices.exists({
      index: this.indices.courses,
    });

    if (!exists) {
      await this.elasticsearch.indices.create({
        index: this.indices.courses,
        mappings: {
          properties: {
            title: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' },
                search: { type: 'search_as_you_type' },
              },
            },
            description: { type: 'text' },
            content: { type: 'text' },
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
      });

      this.logger.log('Created Elasticsearch courses index');
    }
  }

  private async ensureAnalyticsIndex(): Promise<void> {
    const exists = await this.elasticsearch.indices.exists({
      index: this.indices.analytics,
    });

    if (!exists) {
      await this.elasticsearch.indices.create({
        index: this.indices.analytics,
        mappings: {
          properties: {
            query: { type: 'keyword' },
            resultsCount: { type: 'integer' },
            sort: { type: 'keyword' },
            timestamp: { type: 'date' },
          },
        },
      });

      this.logger.log('Created Elasticsearch analytics index');
    }
  }

  async bulkIndexCourses(documents: Array<{ id: string; body: Record<string, unknown> }>) {
    const operations = documents.flatMap((doc) => [
      {
        index: {
          _index: this.indices.courses,
          _id: doc.id,
        },
      },
      doc.body,
    ]);

    return this.elasticsearch.bulk({
      refresh: true,
      operations,
    });
  }

  async deleteCourse(id: string) {
    return this.elasticsearch.delete({
      index: this.indices.courses,
      id,
    });
  }

  async healthCheck() {
    return this.elasticsearch.cluster.health();
  }
}
