import { ElasticsearchService } from './elasticsearch.service';

describe('ElasticsearchService', () => {
  let service: ElasticsearchService;

  const mockElasticsearchClient = {
    indices: {
      exists: jest.fn(),
      create: jest.fn(),
    },
    bulk: jest.fn(),
    delete: jest.fn(),
    cluster: {
      health: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ElasticsearchService(mockElasticsearchClient as any);
  });

  describe('service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should create missing indices on module init', async () => {
      mockElasticsearchClient.indices.exists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      await service.onModuleInit();

      expect(mockElasticsearchClient.indices.create).toHaveBeenCalledTimes(2);
    });

    it('should skip index creation when indices already exist', async () => {
      mockElasticsearchClient.indices.exists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await service.onModuleInit();

      expect(mockElasticsearchClient.indices.create).not.toHaveBeenCalled();
    });
  });

  describe('bulk indexing', () => {
    it('should bulk index course documents', async () => {
      mockElasticsearchClient.bulk.mockResolvedValue({
        errors: false,
      });

      const docs = [
        {
          id: 'course-1',
          body: {
            title: 'NestJS Masterclass',
            category: 'backend',
          },
        },
      ];

      await service.bulkIndexCourses(docs);

      expect(mockElasticsearchClient.bulk).toHaveBeenCalled();
    });
  });

  describe('document deletion', () => {
    it('should delete course by id', async () => {
      mockElasticsearchClient.delete.mockResolvedValue({
        result: 'deleted',
      });

      await service.deleteCourse('course-1');

      expect(mockElasticsearchClient.delete).toHaveBeenCalledWith({
        index: 'courses',
        id: 'course-1',
      });
    });
  });

  describe('health check', () => {
    it('should return cluster health', async () => {
      mockElasticsearchClient.cluster.health.mockResolvedValue({
        status: 'green',
      });

      const result = await service.healthCheck();

      expect(result.status).toBe('green');
    });
  });
});
