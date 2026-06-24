import { Test, TestingModule } from '@nestjs/testing';
import { N1QueryDetectorService } from './n1-query-detector.service';

describe('N1QueryDetectorService', () => {
  let service: N1QueryDetectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [N1QueryDetectorService],
    }).compile();

    service = module.get<N1QueryDetectorService>(N1QueryDetectorService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectPatterns', () => {
    it('returns an empty array when no queries are provided', () => {
      expect(service.detectPatterns([])).toEqual([]);
    });

    it('returns an empty array when all queries are structurally unique', () => {
      const queries = [
        `SELECT * FROM "users" WHERE "id" = $1`,
        `SELECT * FROM "courses" WHERE "id" = $2`,
        `SELECT * FROM "enrollments" WHERE "userId" = $3`,
      ];

      expect(service.detectPatterns(queries)).toEqual([]);
    });

    it('detects repeated structural queries as an N+1 pattern', () => {
      const queries = [
        `SELECT * FROM "users" WHERE "id" = $1`,
        `SELECT * FROM "users" WHERE "id" = $2`,
        `SELECT * FROM "users" WHERE "id" = $3`,
      ];

      const reports = service.detectPatterns(queries);

      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({
        severity: 'low',
        recommendation: expect.stringContaining('JOIN'),
      });
    });

    it('assigns medium severity when a query template repeats 4 to 10 times', () => {
      const queries = Array.from(
        { length: 5 },
        (_v, i) => `SELECT * FROM "courses" WHERE "instructorId" = $${i + 1}`,
      );

      const reports = service.detectPatterns(queries);

      expect(reports).toHaveLength(1);
      expect(reports[0].severity).toBe('medium');
    });

    it('assigns high severity when a query template repeats more than 10 times', () => {
      const queries = Array.from(
        { length: 12 },
        (_v, i) => `SELECT * FROM "courses" WHERE "instructorId" = $${i + 1}`,
      );

      const reports = service.detectPatterns(queries);

      expect(reports).toHaveLength(1);
      expect(reports[0].severity).toBe('high');
    });

    it('groups mixed query types and reports each N+1 pattern separately', () => {
      const queries = [
        `SELECT * FROM "users" WHERE "id" = $1`,
        `SELECT * FROM "users" WHERE "id" = $2`,
        `SELECT * FROM "courses" WHERE "id" = $3`,
        `SELECT * FROM "courses" WHERE "id" = $4`,
      ];

      const reports = service.detectPatterns(queries);

      expect(reports).toHaveLength(2);
    });
  });

  describe('getRecommendedStrategies', () => {
    it('returns a non-empty list of relation load strategies', () => {
      const strategies = service.getRecommendedStrategies();

      expect(strategies.length).toBeGreaterThan(0);
    });

    it('marks all recommended strategies as eager-loading', () => {
      const strategies = service.getRecommendedStrategies();

      for (const strategy of strategies) {
        expect(strategy.useEagerLoading).toBe(true);
      }
    });

    it('includes known problem relations for TeachLink', () => {
      const relations = service.getRecommendedStrategies().map((s) => s.relation);

      expect(relations).toContain('courses.instructor');
      expect(relations).toContain('enrollments.course');
    });
  });
});
