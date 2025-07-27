import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';

export interface EmbeddingModel {
  generateEmbedding(text: string): Promise<number[]>;
  getModelName(): string;
}

export interface SemanticSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, any>;
}

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);
  private embeddingModel: EmbeddingModel | null = null;
  private readonly indexName = 'semantic_search';
  private readonly vectorField = 'embedding';
  private readonly maxVectorSize = 1536; 

  constructor(
    private readonly esService: ElasticsearchService,
    private readonly configService: ConfigService,
    @Inject('EMBEDDING_MODEL') private readonly modelProvider?: EmbeddingModel,
  ) {
    this.initializeEmbeddingModel();
  }

  private async initializeEmbeddingModel() {
    try {
      const modelType = this.configService.get<string>('SEMANTIC_MODEL_TYPE', 'openai');
      
      switch (modelType) {
        case 'openai':
          this.embeddingModel = await this.createOpenAIModel();
          break;
        case 'huggingface':
          this.embeddingModel = await this.createHuggingFaceModel();
          break;
        case 'local':
          this.embeddingModel = await this.createLocalModel();
          break;
        default:
          this.logger.warn(`Unknown model type: ${modelType}, using placeholder`);
          this.embeddingModel = this.createPlaceholderModel();
      }
      
      this.logger.log(`Initialized semantic search with model: ${this.embeddingModel.getModelName()}`);
    } catch (error) {
      this.logger.error('Failed to initialize embedding model', error);
      this.embeddingModel = this.createPlaceholderModel();
    }
  }

  private async createOpenAIModel(): Promise<EmbeddingModel> {
    const { OpenAIEmbeddings } = await import('langchain/embeddings/openai');
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    return {
      generateEmbedding: async (text: string) => {
        const embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey });
        const result = await embeddings.embedQuery(text);
        return result;
      },
      getModelName: () => 'openai-ada-002',
    };
  }

  private async createHuggingFaceModel(): Promise<EmbeddingModel> {
    const { HuggingFaceInferenceEmbeddings } = await import('langchain/embeddings/hf');
    const apiKey = this.configService.get<string>('HUGGINGFACE_API_KEY');
    
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }

    return {
      generateEmbedding: async (text: string) => {
        const embeddings = new HuggingFaceInferenceEmbeddings({
          apiKey,
          model: 'sentence-transformers/all-MiniLM-L6-v2',
        });
        const result = await embeddings.embedQuery(text);
        return result;
      },
      getModelName: () => 'sentence-transformers/all-MiniLM-L6-v2',
    };
  }

  private async createLocalModel(): Promise<EmbeddingModel> {
    // For local models, you might use ONNX, TensorFlow.js, or similar
    const { pipeline } = await import('@xenova/transformers');
    
    return {
      generateEmbedding: async (text: string) => {
        const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        const result = await embedder(text, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
      },
      getModelName: () => 'local-all-MiniLM-L6-v2',
    };
  }

  private createPlaceholderModel(): EmbeddingModel {
    return {
      generateEmbedding: async (text: string) => {
        // Generate a deterministic "embedding" for testing
        const hash = this.simpleHash(text);
        const embedding = new Array(this.maxVectorSize).fill(0);
        for (let i = 0; i < Math.min(hash.length, this.maxVectorSize); i++) {
          embedding[i] = (hash.charCodeAt(i) % 100) / 100;
        }
        return embedding;
      },
      getModelName: () => 'placeholder-model',
    };
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  async semanticSearch(
    query: string,
    filters: any = {},
    from = 0,
    size = 10,
    threshold = 0.7,
  ): Promise<SemanticSearchResult[]> {
    const startTime = Date.now();
    
    try {
      if (!query?.trim()) {
        throw new BadRequestException('Query cannot be empty');
      }

      this.logger.debug(`Performing semantic search for query: "${query}"`);

      // Generate embedding for the query
      const queryEmbedding = await this.embeddingModel!.generateEmbedding(query);
      
      if (!queryEmbedding || queryEmbedding.length === 0) {
        throw new BadRequestException('Failed to generate query embedding');
      }

      // Build Elasticsearch query with vector search
      const searchQuery = this.buildSemanticSearchQuery(queryEmbedding, filters, threshold);
      
      const params = {
        index: this.indexName,
        from,
        size,
        body: searchQuery as any,
      };

      const result = await this.esService.search(params);
      
      const results: SemanticSearchResult[] = result.hits.hits
        .filter(hit => hit._score && hit._score >= threshold)
        .map(hit => {
          const source = hit._source as any;
          return {
            id: hit._id,
            score: hit._score,
            content: source.content,
            metadata: source.metadata || {},
          };
        });

      const duration = Date.now() - startTime;
      this.logger.log(`Semantic search completed in ${duration}ms, found ${results.length} results`);

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Semantic search failed after ${duration}ms`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Semantic search failed. Please try again.');
    }
  }

  private buildSemanticSearchQuery(
    queryEmbedding: number[],
    filters: any,
    threshold: number,
  ) {
    const mustClauses = [
      {
        script_score: {
          query: { match_all: {} },
          script: {
            source: 'cosineSimilarity(params.query_vector, "embedding") + 1.0',
            params: { query_vector: queryEmbedding },
          },
        },
      },
    ];

    // Add filters if provided
    if (filters && Object.keys(filters).length > 0) {
      const filterClauses = this.buildFilterClauses(filters);
      mustClauses.push(...filterClauses);
    }

    return {
      query: {
        bool: {
          must: mustClauses,
          min_score: threshold,
        },
      },
      sort: [{ _score: { order: 'desc' } }],
    };
  }

  private buildFilterClauses(filters: any): any[] {
    const clauses: any[] = [];
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          clauses.push({ terms: { [key]: value } });
        } else {
          clauses.push({ term: { [key]: value } });
        }
      }
    });
    
    return clauses;
  }

  async indexDocument(id: string, content: string, metadata: Record<string, any> = {}) {
    try {
      const embedding = await this.embeddingModel!.generateEmbedding(content);
      
      await this.esService.index({
        index: this.indexName,
        id,
        body: {
          content,
          embedding,
          metadata,
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.debug(`Indexed document ${id} with embedding`);
    } catch (error) {
      this.logger.error(`Failed to index document ${id}`, error);
      throw new BadRequestException('Failed to index document for semantic search');
    }
  }

  async deleteDocument(id: string) {
    try {
      await this.esService.delete({
        index: this.indexName,
        id,
      });
      
      this.logger.debug(`Deleted document ${id} from semantic index`);
    } catch (error) {
      this.logger.error(`Failed to delete document ${id}`, error);
      // Don't throw error for deletion failures
    }
  }

  async getModelInfo() {
    return {
      modelName: this.embeddingModel?.getModelName() || 'unknown',
      vectorSize: this.maxVectorSize,
      isPlaceholder: this.embeddingModel?.getModelName() === 'placeholder-model',
    };
  }
} 