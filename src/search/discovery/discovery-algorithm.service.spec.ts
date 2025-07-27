import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryAlgorithmService } from './discovery-algorithm.service';

describe('DiscoveryAlgorithmService', () => {
  let service: DiscoveryAlgorithmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiscoveryAlgorithmService],
    }).compile();

    service = module.get<DiscoveryAlgorithmService>(DiscoveryAlgorithmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should personalize results (returns array)', async () => {
    const results = await service.personalizeResults('user1', [{ id: 1 }, { id: 2 }]);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
  });
}); 