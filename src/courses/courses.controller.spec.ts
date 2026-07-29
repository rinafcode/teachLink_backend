import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseReview } from './entities/course-review.entity';
import { CourseVersion } from './entities/course-version.entity';
import { BulkOperation } from './entities/bulk-operation.entity';
import { PaginationService } from '../common/services/pagination.service';
import { User, UserRole } from '../users/entities/user.entity';

describe('CoursesController Pagination (#826)', () => {
  let controller: CoursesController;
  let service: CoursesService;

  const dataset: Course[] = [
    {
      id: 'c1',
      title: 'Course 1',
      status: CourseStatus.PUBLISHED,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    } as Course,
    {
      id: 'c2',
      title: 'Course 2',
      status: CourseStatus.PUBLISHED,
      createdAt: new Date('2026-01-02T00:00:00Z'),
    } as Course,
    {
      id: 'c3',
      title: 'Course 3',
      status: CourseStatus.PUBLISHED,
      createdAt: new Date('2026-01-03T00:00:00Z'),
    } as Course,
    {
      id: 'c4',
      title: 'Course 4',
      status: CourseStatus.PUBLISHED,
      createdAt: new Date('2026-01-04T00:00:00Z'),
    } as Course,
    {
      id: 'c5',
      title: 'Course 5',
      status: CourseStatus.PUBLISHED,
      createdAt: new Date('2026-01-05T00:00:00Z'),
    } as Course,
  ];

  const adminUser: User = {
    id: 'user-admin',
    role: UserRole.ADMIN,
    hasRole: () => true,
  } as any;

  const mockCourseRepo = {
    createQueryBuilder: jest.fn().mockImplementation((alias) => {
      let whereClause: any = null;
      let andWhereClause: any = null;
      let takeVal = 20;
      let skipVal = 0;

      const qb: any = {
        alias,
        where: jest.fn().mockImplementation((cond, params) => {
          whereClause = { cond, params };
          return qb;
        }),
        andWhere: jest.fn().mockImplementation((cond, params) => {
          andWhereClause = { cond, params };
          return qb;
        }),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockImplementation((val) => {
          skipVal = val;
          return qb;
        }),
        take: jest.fn().mockImplementation((val) => {
          takeVal = val;
          return qb;
        }),
        getManyAndCount: jest.fn().mockImplementation(async () => {
          let items = [...dataset];
          if (whereClause?.params?.status) {
            items = items.filter((i) => i.status === whereClause.params.status);
          }
          const total = items.length;
          const paged = items.slice(skipVal, skipVal + takeVal);
          return [paged, total];
        }),
        getMany: jest.fn().mockImplementation(async () => {
          let items = [...dataset];
          if (whereClause?.params?.status) {
            items = items.filter((i) => i.status === whereClause.params.status);
          }
          if (andWhereClause?.params?.cursorDate && andWhereClause?.params?.cursorId) {
            const cDate = andWhereClause.params.cursorDate;
            const cId = andWhereClause.params.cursorId;
            items = items.filter(
              (i) =>
                i.createdAt > cDate || (i.createdAt.getTime() === cDate.getTime() && i.id > cId),
            );
          }
          return items.slice(0, takeVal);
        }),
      };
      return qb;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        CoursesService,
        PaginationService,
        { provide: getRepositoryToken(Course), useValue: mockCourseRepo },
        { provide: getRepositoryToken(CourseReview), useValue: {} },
        { provide: getRepositoryToken(CourseVersion), useValue: {} },
        { provide: getRepositoryToken(BulkOperation), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
    service = module.get<CoursesService>(CoursesService);
  });

  it('1. cursor_response_includes_next_cursor', async () => {
    const req = { user: adminUser };
    const res = await controller.findAll(req, { limit: 2 } as any);

    expect(res.data).toHaveLength(2);
    expect(res.nextCursor).toBeDefined();
    expect(res.nextCursor).not.toBeNull();
    expect(typeof res.nextCursor).toBe('string');
  });

  it('2. cursor_pagination_returns_no_duplicates_or_gaps', async () => {
    const req = { user: adminUser };

    // Request Page 1 (limit 2)
    const page1 = await controller.findAll(req, { limit: 2 } as any);
    expect(page1.data).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    // Request Page 2 (limit 2) with cursor from Page 1
    const page2 = await controller.findAll(req, { limit: 2, cursor: page1.nextCursor! } as any);
    expect(page2.data).toHaveLength(2);

    // Request Page 3 (limit 2) with cursor from Page 2
    const page3 = await controller.findAll(req, { limit: 2, cursor: page2.nextCursor! } as any);
    expect(page3.data).toHaveLength(1);

    const allIds = [
      ...page1.data.map((c) => c.id),
      ...page2.data.map((c) => c.id),
      ...page3.data.map((c) => c.id),
    ];

    // Assert no duplicates
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);

    // Assert no gaps (matches dataset)
    const expectedIds = dataset.map((c) => c.id);
    expect(allIds).toEqual(expectedIds);
  });

  it('3. offset_pagination_still_works', async () => {
    const req = { user: adminUser };
    const res = await controller.findAll(req, { page: 1, limit: 2 } as any);

    expect(res.data).toHaveLength(2);
    expect(res.total).toBe(5);
    expect(res.page).toBe(1);
    expect(res.limit).toBe(2);
    expect(res.totalPages).toBe(3);
    expect(res.hasNextPage).toBe(true);
    expect(res.hasPrevPage).toBe(false);
    expect(res.data[0].id).toBe('c1');
    expect(res.data[1].id).toBe('c2');
  });

  it('4. next_cursor_is_null_on_last_page', async () => {
    const req = { user: adminUser };

    // Page 1
    const page1 = await controller.findAll(req, { limit: 2 } as any);
    // Page 2
    const page2 = await controller.findAll(req, { limit: 2, cursor: page1.nextCursor! } as any);
    // Page 3 (last page with remaining 1 item)
    const page3 = await controller.findAll(req, { limit: 2, cursor: page2.nextCursor! } as any);

    expect(page3.data).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();
  });
});
