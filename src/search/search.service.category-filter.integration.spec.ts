import { DataSource, EntitySchema, Repository } from 'typeorm';
import { SearchService, SearchFilters } from './search.service';
import { Course, CourseStatus } from '../courses/entities/course.entity';

/**
 * Issue #995 — `qb.andWhere('course.category IN (:cats)', { cats })` bound an
 * array to a scalar placeholder, so category filtering either matched
 * nothing or threw at the driver. The mocked-qb unit tests in
 * `search.service.spec.ts` only assert the SQL string, not that Postgres
 * actually accepts the bound parameter — this test exercises the real
 * TypeORM query builder against Postgres, seeding courses across two
 * categories and asserting filtering returns exactly the requested ones.
 *
 * Uses an `EntitySchema` mirroring just the columns `SearchService.search()`
 * touches, backed by a throwaway table, instead of the real `Course` entity
 * — that avoids dragging in the full `Course` relation graph (User, Role,
 * CourseModule, Enrollment, ...) just to resolve entity metadata, and avoids
 * `synchronize: true` altering the real `course` table's schema.
 *
 * Requires a reachable Postgres instance configured via the same DATABASE_*
 * env vars the app uses (see src/config/database.config.ts). Like the other
 * `*.integration.spec.ts` files in this repo, it is excluded from the
 * default `npm test` run — run it explicitly against a live database.
 */
describe('SearchService category/level/language filters (Postgres integration)', () => {
  const TEST_TABLE = 'course_search_filter_test';

  interface CourseRow {
    id: string;
    title: string;
    description: string;
    category: string | null;
    level: string | null;
    language: string | null;
    price: number;
    status: string;
    instructorId: string;
    createdAt: Date;
    updatedAt: Date;
  }

  const CourseTestSchema = new EntitySchema<CourseRow>({
    name: 'Course',
    tableName: TEST_TABLE,
    columns: {
      id: { type: 'uuid', primary: true, generated: 'uuid' },
      title: { type: String },
      description: { type: 'text' },
      category: { type: String, nullable: true },
      level: { type: String, nullable: true },
      language: { type: String, nullable: true },
      price: { type: 'decimal', precision: 10, scale: 2, default: 0 },
      status: { type: String, default: CourseStatus.PUBLISHED },
      instructorId: { type: String },
      createdAt: { type: 'timestamp', createDate: true },
      updatedAt: { type: 'timestamp', updateDate: true },
    },
  });

  let dataSource: DataSource;
  let courseRepository: Repository<CourseRow>;
  let service: SearchService;

  const noopElasticsearch = { ping: jest.fn(), search: jest.fn() } as any;
  const metricsService = { searchFallbackCounter: { inc: jest.fn() } } as any;

  async function search(filters: SearchFilters) {
    return service.search('', filters);
  }

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
      username: process.env.DATABASE_USER ?? 'postgres',
      password: process.env.DATABASE_PASSWORD ?? 'postgres',
      database: process.env.DATABASE_NAME ?? 'teachlink',
      entities: [CourseTestSchema],
      synchronize: true,
    });
    await dataSource.initialize();
    courseRepository = dataSource.getRepository<CourseRow>('Course');

    // SearchService is constructed directly (not via full AppModule DI) so
    // this test only needs Postgres, not the rest of the app's required env.
    // The EntitySchema-backed repository satisfies the same Repository<Course>
    // surface SearchService relies on (createQueryBuilder / getManyAndCount).
    service = new SearchService(
      courseRepository as unknown as Repository<Course>,
      noopElasticsearch,
      metricsService,
    );
  });

  afterAll(async () => {
    await dataSource.query(`DROP TABLE IF EXISTS "${TEST_TABLE}" CASCADE`);
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await courseRepository.query(`TRUNCATE TABLE "${TEST_TABLE}" CASCADE`);
    await courseRepository.save([
      courseRepository.create({
        title: 'Intro to Design Systems',
        description: 'design',
        category: 'design',
        level: 'beginner',
        language: 'en',
        status: CourseStatus.PUBLISHED,
        instructorId: 'instructor-1',
      }),
      courseRepository.create({
        title: 'Advanced Business Strategy',
        description: 'business',
        category: 'business',
        level: 'advanced',
        language: 'en',
        status: CourseStatus.PUBLISHED,
        instructorId: 'instructor-1',
      }),
      courseRepository.create({
        title: 'Deep Learning Fundamentals',
        description: 'data-science',
        category: 'data-science',
        level: 'intermediate',
        language: 'es',
        status: CourseStatus.PUBLISHED,
        instructorId: 'instructor-1',
      }),
    ]);
  });

  it('returns courses from both requested categories and none from others', async () => {
    const result = await search({ category: ['design', 'business'] });

    expect(result.total).toBe(2);
    const categories = result.results.map((c: CourseRow) => c.category).sort();
    expect(categories).toEqual(['business', 'design']);
  });

  it('returns courses from a single requested category', async () => {
    const result = await search({ category: 'design' });

    expect(result.total).toBe(1);
    expect(result.results[0].category).toBe('design');
  });

  it('honours the level filter declared in SearchFilters', async () => {
    const result = await search({ level: ['beginner', 'advanced'] });

    expect(result.total).toBe(2);
    const levels = result.results.map((c: CourseRow) => c.level).sort();
    expect(levels).toEqual(['advanced', 'beginner']);
  });

  it('honours the language filter declared in SearchFilters', async () => {
    const result = await search({ language: 'es' });

    expect(result.total).toBe(1);
    expect(result.results[0].language).toBe('es');
  });

  it('combines category and level filters', async () => {
    const result = await search({ category: 'design', level: 'advanced' });

    expect(result.total).toBe(0);
  });
});
