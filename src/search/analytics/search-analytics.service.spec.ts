import { Test, TestingModule } from '@nestjs/testing';
import { SearchAnalyticsService } from './search-analytics.service';

describe('SearchAnalyticsService', () => {
  let service: SearchAnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchAnalyticsService],
    }).compile();

    service = module.get<SearchAnalyticsService>(SearchAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log searches and return analytics', () => {
    service.logSearch('user1', 'test', {});
    const analytics = service.getAnalytics();
    expect(analytics.totalSearches).toBeGreaterThan(0);
  });
}); 