import { Test, TestingModule } from '@nestjs/testing';
import { IndexingService } from './indexing.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';

describe('IndexingService', () => {
  let service: IndexingService;
  let esService: { index: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    esService = { index: jest.fn(), delete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexingService,
        { provide: ElasticsearchService, useValue: esService },
      ],
    }).compile();

    service = module.get<IndexingService>(IndexingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should index a course', async () => {
    await service.indexCourse({ id: '1', title: 'Test' });
    expect(esService.index).toHaveBeenCalledWith({
      index: 'courses',
      id: '1',
      body: { id: '1', title: 'Test' },
    });
  });

  it('should remove a course', async () => {
    await service.removeCourse('1');
    expect(esService.delete).toHaveBeenCalledWith({
      index: 'courses',
      id: '1',
    });
  });
}); 