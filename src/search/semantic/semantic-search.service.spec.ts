import { Test, TestingModule } from '@nestjs/testing';
import { SemanticSearchService } from './semantic-search.service';

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SemanticSearchService],
    }).compile();

    service = module.get<SemanticSearchService>(SemanticSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return an array for semanticSearch', async () => {
    const results = await service.semanticSearch('test', {}, 0, 10);
    expect(Array.isArray(results)).toBe(true);
  });
}); 