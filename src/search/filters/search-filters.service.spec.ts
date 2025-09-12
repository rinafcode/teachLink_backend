import { SearchFiltersService } from './search-filters.service';

describe('SearchFiltersService', () => {
  let service: SearchFiltersService;

  beforeEach(() => {
    service = new SearchFiltersService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should build filter query for category and level', () => {
    const filters = { category: 'math', level: 'beginner' };
    const result = service.buildFilterQuery(filters);
    expect(result).toEqual([
      { term: { category: 'math' } },
      { term: { level: 'beginner' } },
    ]);
  });

  it('should return empty array if no filters', () => {
    expect(service.buildFilterQuery({})).toEqual([]);
  });
});
