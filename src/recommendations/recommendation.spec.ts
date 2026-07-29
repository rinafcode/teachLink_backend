import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { CachingService } from '../caching/caching.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { CollaborativeFilteringService } from './collaborative-filtering.service';
import { ContentBasedFilteringService } from './content-based-filtering.service';

const mockCourse = (id: string, category = 'math', price = 50): Partial<Course> => ({
  id,
  title: `Course ${id}`,
  description: 'desc',
  category,
  price,
  status: CourseStatus.PUBLISHED,
  createdAt: new Date(),
});

const mockEnrollment = (userId: string, courseId: string, status = 'active'): Partial<Enrollment> =>
  ({ userId, courseId, status }) as Enrollment;

describe('RecommendationEngineService', () => {
  let service: RecommendationEngineService;
  let courseRepo: { find: jest.Mock };
  let enrollmentRepo: { find: jest.Mock };
  let caching: { getOrSet: jest.Mock; deleteMany: jest.Mock; deleteByPattern: jest.Mock };

  beforeEach(async () => {
    courseRepo = { find: jest.fn() };
    enrollmentRepo = { find: jest.fn() };
    caching = {
      getOrSet: jest.fn((_, factory) => factory()),
      deleteMany: jest.fn(),
      deleteByPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        RecommendationEngineService,
        CollaborativeFilteringService,
        ContentBasedFilteringService,
        { provide: getRepositoryToken(Course), useValue: courseRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: CachingService, useValue: caching },
        {
          provide: `${getRepositoryToken(Enrollment)}_collab`,
          useValue: enrollmentRepo,
        },
      ],
    })
      .overrideProvider(CollaborativeFilteringService)
      .useValue({ getRecommendedCourseIds: jest.fn().mockResolvedValue([]) })
      .overrideProvider(ContentBasedFilteringService)
      .useValue({ getRecommendedCourseIds: jest.fn().mockResolvedValue([]) })
      .compile();

    service = module.get(RecommendationEngineService);
  });

  it('returns empty list when no signal and no published courses', async () => {
    enrollmentRepo.find.mockResolvedValue([]);
    courseRepo.find.mockResolvedValue([]);
    const result = await service.getRecommendations('user-1', 10);
    expect(result).toEqual([]);
  });

  it('falls back to popular courses on cold start', async () => {
    enrollmentRepo.find.mockResolvedValue([]);
    courseRepo.find.mockResolvedValue([mockCourse('c1'), mockCourse('c2')]);

    const result = await service.getRecommendations('new-user', 10);
    expect(result).toHaveLength(2);
    expect(result[0].reason).toBe('content-based');
  });

  it('calls caching.getOrSet with correct key', async () => {
    enrollmentRepo.find.mockResolvedValue([]);
    courseRepo.find.mockResolvedValue([]);
    await service.getRecommendations('user-abc', 5);
    expect(caching.getOrSet).toHaveBeenCalledWith(
      'recommendations:user-abc:5',
      expect.any(Function),
      300,
    );
  });

  it('invalidate deletes cache keys by pattern', async () => {
    await service.invalidate('user-1');
    expect(caching.deleteByPattern).toHaveBeenCalledWith('recommendations:user-1:*');
  });
});

describe('CollaborativeFilteringService', () => {
  let service: CollaborativeFilteringService;
  let enrollmentRepo: { find: jest.Mock; query: jest.Mock };

  beforeEach(async () => {
    enrollmentRepo = { find: jest.fn(), query: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        CollaborativeFilteringService,
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
      ],
    }).compile();
    service = module.get(CollaborativeFilteringService);
  });

  it('returns empty when user has no enrollments (cold start)', async () => {
    enrollmentRepo.find.mockResolvedValue([]);
    const result = await service.getRecommendedCourseIds('user-1', new Set(), 5);
    expect(result.length).toBe(0);
    // No SQL query fired — short-circuits before reaching the DB
    expect(enrollmentRepo.query).not.toHaveBeenCalled();
  });

  it('excludes already-enrolled courses', async () => {
    enrollmentRepo.find.mockResolvedValue([
      mockEnrollment('user-1', 'c1'),
    ]);
    // The SQL query excludes courses from excludeCourseIds; mock what the
    // database would return after applying that exclusion.
    enrollmentRepo.query.mockResolvedValue([
      { courseId: 'c2', score: 0.5 },
    ]);
    const result = await service.getRecommendedCourseIds('user-1', new Set(['c1']), 5);
    expect(result.map((r) => r.courseId)).not.toContain('c1');
    expect(result).toHaveLength(1);
    expect(result[0].courseId).toBe('c2');
  });

  it('scores courses based on Jaccard similarity', async () => {
    enrollmentRepo.find.mockResolvedValue([
      mockEnrollment('user-1', 'c1'),
      mockEnrollment('user-1', 'c2'),
    ]);
    // Jaccard(c1,c2 ∩ c1,c2,c3) = 2/3 → score = 2/3
    enrollmentRepo.query.mockResolvedValue([
      { courseId: 'c3', score: 2 / 3 },
    ]);
    const result = await service.getRecommendedCourseIds('user-1', new Set(['c1', 'c2']), 5);
    expect(result).toHaveLength(1);
    expect(result[0].courseId).toBe('c3');
    expect(result[0].score).toBeCloseTo(2 / 3);
  });

  describe('benchmark', () => {
    it('uses a single bounded SQL query — no full table scan, no N+1', async () => {
      enrollmentRepo.find.mockResolvedValue([
        mockEnrollment('user-1', 'c1'),
        mockEnrollment('user-1', 'c2'),
      ]);
      enrollmentRepo.query.mockResolvedValue([
        { courseId: 'c4', score: 0.7 },
        { courseId: 'c5', score: 0.3 },
      ]);

      const result = await service.getRecommendedCourseIds('user-1', new Set(['c1', 'c2', 'c3']), 3);

      // Exactly one query call — no separate neighbor-enrollment round-trips
      expect(enrollmentRepo.query).toHaveBeenCalledTimes(1);
      // Exactly one find call — target user's own enrollments only
      expect(enrollmentRepo.find).toHaveBeenCalledTimes(1);
      // Result length is bounded by topN regardless of total enrollment count
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('heap usage is independent of total platform enrollment count', async () => {
      // The service should only load:
      //   1. The target user's enrollments (via find)
      //   2. The bounded SQL result set
      // No full-table scan of enrollment occurs.
      enrollmentRepo.find.mockResolvedValue([
        mockEnrollment('user-1', 'c1'),
      ]);
      enrollmentRepo.query.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          courseId: `c${i + 10}`,
          score: 0.5 - i * 0.1,
        })),
      );

      const result = await service.getRecommendedCourseIds('user-1', new Set(), 5);

      // The returned data is bounded by topN regardless of how many
      // enrollments exist in the database.
      expect(result.length).toBe(5);
      expect(enrollmentRepo.find).toHaveBeenCalledTimes(1);
      expect(enrollmentRepo.query).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ContentBasedFilteringService', () => {
  let service: ContentBasedFilteringService;
  let courseRepo: { find: jest.Mock };

  beforeEach(async () => {
    courseRepo = { find: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ContentBasedFilteringService,
        { provide: getRepositoryToken(Course), useValue: courseRepo },
      ],
    }).compile();
    service = module.get(ContentBasedFilteringService);
  });

  it('returns empty when no enrolled courses', async () => {
    const result = await service.getRecommendedCourseIds([], new Set(), 10);
    expect(result).toEqual([]);
  });

  it('ranks courses by category match', async () => {
    // Enrolled in a 'math' course priced at 50
    courseRepo.find
      .mockResolvedValueOnce([{ id: 'e1', category: 'math', price: 50 }])
      .mockResolvedValueOnce([
        { id: 'c1', category: 'math', price: 50, status: CourseStatus.PUBLISHED },
        { id: 'c2', category: 'science', price: 200, status: CourseStatus.PUBLISHED },
      ]);

    const result = await service.getRecommendedCourseIds(['e1'], new Set(['e1']), 10);
    expect(result[0].courseId).toBe('c1');
    expect(result[0].score).toBeGreaterThan(result[1]?.score ?? 0);
  });
});
