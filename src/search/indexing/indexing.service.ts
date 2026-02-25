import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class IndexingService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async indexDocument(index: string, id: string, document: any) {
    return this.elasticsearchService.index({
      index,
      id,
      body: document,
    });
  }

  async updateDocument(index: string, id: string, document: any) {
    return this.elasticsearchService.update({
      index,
      id,
      body: { doc: document },
    });
  }

  async deleteDocument(index: string, id: string) {
    return this.elasticsearchService.delete({
      index,
      id,
    });
  }

  async createIndex(index: string, mapping: any) {
    return this.elasticsearchService.indices.create({
      index,
      body: {
        mappings: mapping,
      },
    });
  }

  async bulkIndex(documents: any[]) {
    const body = documents.flatMap(doc => [
      { index: { _index: 'courses', _id: doc.id } },
      doc,
    ]);

    return this.elasticsearchService.bulk({ body });
  }
}
