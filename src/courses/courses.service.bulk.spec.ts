import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseReview } from './entities/course-review.entity';
import {
  BulkOperation,
  BulkOperationStatus,
  BulkOperationType,
} from './entities/bulk-operation.entity';

/**
 * Helper that builds a Course-shaped object for tests. We don't extend the real
 * entity because TypeORM decorators carry runtime metadata we don't need here.
 */
const makeCourse = (overrides: Partial<Course> = {}): Course =>
  ({
    id: overrides.id ?? 'course-1',
    title: 'Test course',
    description: 'desc',
    price: 10,
    status: CourseStatus.DRAFT,
    instructorId: overrides.instructorId ?? 'instructor-1',
    category: undefined,
    ...overrides,
  } as unknown as Course);

const owner = { id: 'instructor-1', roles: [] as any[] } as any;
const otherUser = { id: 'instructor-2', roles: [] as any[] } as any;
const admin = { id: 'admin-1', roles: ['admin'] as any[] } as any;

describe('CoursesService - bulk operations', () => {
  let service: CoursesService;

  const courseRepo = {
    find: jest.fn(),
    save: jest.fn((entity: any) => Promise.resolve(entity)),
  };
  const reviewRepo = {};
  const bulkOpRepo = {
    create: jest.fn((data: any) => data),
    save: jest.fn((entity: any) => Promise.resolve({ id: 'op-1', ...entity })),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const eventEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: getRepositoryToken(Course), useValue: courseRepo },
        { provide: getRepositoryToken(CourseReview), useValue: reviewRepo },
        { provide: getRepositoryToken(BulkOperation), useValue: bulkOpRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  // ─── bulkPublish ──────────────────────────────────────────────────────────

  describe('bulkPublish', () => {
    it('publishes courses owned by the caller and snapshots previous status', async () => {
      const c1 = makeCourse({ id: 'c1', status: CourseStatus.DRAFT });
      const c2 = makeCourse({ id: 'c2', status: CourseStatus.DRAFT });
      courseRepo.find.mockResolvedValueOnce([c1, c2]);

      const op = await service.bulkPublish(
        { courseIds: ['c1', 'c2'], publish: true },
        owner,
      );

      expect(c1.status).toBe(CourseStatus.PUBLISHED);
      expect(c2.status).toBe(CourseStatus.PUBLISHED);
      expect(courseRepo.save).toHaveBeenCalledWith([c1, c2]);
      expect(op.type).toBe(BulkOperationType.PUBLISH);
      expect(op.status).toBe(BulkOperationStatus.COMPLETED);
      expect(op.successCount).toBe(2);
      expect(op.failureCount).toBe(0);
      expect(op.snapshots[0]).toMatchObject({
        courseId: 'c1',
        applied: true,
        previous: { status: CourseStatus.DRAFT },
      });
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    });

    it('unpublish moves courses to ARCHIVED', async () => {
      const c1 = makeCourse({ id: 'c1', status: CourseStatus.PUBLISHED });
      courseRepo.find.mockResolvedValueOnce([c1]);

      await service.bulkPublish({ courseIds: ['c1'], publish: false }, owner);

      expect(c1.status).toBe(CourseStatus.ARCHIVED);
    });

    it('skips courses owned by another instructor and reports them as FORBIDDEN', async () => {
      const mine = makeCourse({ id: 'c1' });
      const theirs = makeCourse({ id: 'c2', instructorId: 'someone-else' });
      courseRepo.find.mockResolvedValueOnce([mine, theirs]);

      const op = await service.bulkPublish(
        { courseIds: ['c1', 'c2'], publish: true },
        owner,
      );

      expect(op.status).toBe(BulkOperationStatus.PARTIAL);
      expect(op.successCount).toBe(1);
      expect(op.failureCount).toBe(1);
      const failed = op.snapshots.find(s => s.courseId === 'c2');
      expect(failed?.applied).toBe(false);
      expect(failed?.error).toBe('FORBIDDEN');
    });

    it('marks missing courses as NOT_FOUND', async () => {
      courseRepo.find.mockResolvedValueOnce([]);

      const op = await service.bulkPublish(
        { courseIds: ['missing-1'], publish: true },
        owner,
      );

      expect(op.status).toBe(BulkOperationStatus.FAILED);
      expect(op.snapshots[0].error).toBe('NOT_FOUND');
      expect(courseRepo.save).not.toHaveBeenCalled();
    });

    it('admin can bulk publish courses owned by other instructors', async () => {
      const someoneElses = makeCourse({ id: 'c1', instructorId: 'instructor-x' });
      courseRepo.find.mockResolvedValueOnce([someoneElses]);

      const op = await service.bulkPublish(
        { courseIds: ['c1'], publish: true },
        admin,
      );

      expect(op.status).toBe(BulkOperationStatus.COMPLETED);
      expect(someoneElses.status).toBe(CourseStatus.PUBLISHED);
    });
  });

  // ─── bulkUpdatePrice ──────────────────────────────────────────────────────

  describe('bulkUpdatePrice', () => {
    it('updates price and snapshots the previous numeric value', async () => {
      const c1 = makeCourse({ id: 'c1', price: 10 });
      const c2 = makeCourse({ id: 'c2', price: 20 });
      courseRepo.find.mockResolvedValueOnce([c1, c2]);

      const op = await service.bulkUpdatePrice(
        { courseIds: ['c1', 'c2'], price: 99.99 },
        owner,
      );

      expect(c1.price).toBe(99.99);
      expect(c2.price).toBe(99.99);
      expect(op.type).toBe(BulkOperationType.PRICE_UPDATE);
      expect(op.snapshots.map(s => s.previous.price)).toEqual([10, 20]);
    });
  });

  // ─── bulkUpdateCategory ───────────────────────────────────────────────────

  describe('bulkUpdateCategory', () => {
    it('sets category and snapshots previous value', async () => {
      const c1 = makeCourse({ id: 'c1', category: 'old' });
      courseRepo.find.mockResolvedValueOnce([c1]);

      const op = await service.bulkUpdateCategory(
        { courseIds: ['c1'], category: 'web-development' },
        owner,
      );

      expect(c1.category).toBe('web-development');
      expect(op.snapshots[0].previous.category).toBe('old');
    });

    it('clears category when null is provided', async () => {
      const c1 = makeCourse({ id: 'c1', category: 'old' });
      courseRepo.find.mockResolvedValueOnce([c1]);

      await service.bulkUpdateCategory(
        { courseIds: ['c1'], category: null },
        owner,
      );

      expect(c1.category).toBeUndefined();
    });
  });

  // ─── undoBulkOperation ────────────────────────────────────────────────────

  describe('undoBulkOperation', () => {
    it('throws NotFoundException when the operation does not exist', async () => {
      bulkOpRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.undoBulkOperation('missing', owner)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects callers that did not initiate the op and are not privileged', async () => {
      bulkOpRepo.findOne.mockResolvedValueOnce({
        id: 'op-1',
        initiatedById: owner.id,
        status: BulkOperationStatus.COMPLETED,
        snapshots: [],
      });
      await expect(service.undoBulkOperation('op-1', otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects already-undone operations', async () => {
      bulkOpRepo.findOne.mockResolvedValueOnce({
        id: 'op-1',
        initiatedById: owner.id,
        status: BulkOperationStatus.UNDONE,
        snapshots: [],
      });
      await expect(service.undoBulkOperation('op-1', owner)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('restores previous price/status/category for applied snapshots', async () => {
      const c1 = makeCourse({
        id: 'c1',
        status: CourseStatus.PUBLISHED,
        price: 99,
        category: 'new',
      });
      bulkOpRepo.findOne.mockResolvedValueOnce({
        id: 'op-1',
        initiatedById: owner.id,
        status: BulkOperationStatus.COMPLETED,
        snapshots: [
          {
            courseId: 'c1',
            applied: true,
            previous: { status: CourseStatus.DRAFT, price: 10, category: 'old' },
          },
          { courseId: 'c2', applied: false, previous: {}, error: 'NOT_FOUND' },
        ],
      });
      courseRepo.find.mockResolvedValueOnce([c1]);

      const result = await service.undoBulkOperation('op-1', owner);

      expect(c1.status).toBe(CourseStatus.DRAFT);
      expect(c1.price).toBe(10);
      expect(c1.category).toBe('old');
      expect(courseRepo.save).toHaveBeenCalledWith([c1]);
      expect(result.status).toBe(BulkOperationStatus.UNDONE);
      expect(result.undoneAt).toBeInstanceOf(Date);
    });

    it('clears category back to null if previous value was null', async () => {
      const c1 = makeCourse({ id: 'c1', category: 'web-dev' });
      bulkOpRepo.findOne.mockResolvedValueOnce({
        id: 'op-1',
        initiatedById: owner.id,
        status: BulkOperationStatus.COMPLETED,
        snapshots: [
          { courseId: 'c1', applied: true, previous: { category: null } },
        ],
      });
      courseRepo.find.mockResolvedValueOnce([c1]);

      await service.undoBulkOperation('op-1', owner);

      expect(c1.category).toBeUndefined();
    });

    it('marks the op UNDONE without saving courses when nothing was applied', async () => {
      bulkOpRepo.findOne.mockResolvedValueOnce({
        id: 'op-1',
        initiatedById: owner.id,
        status: BulkOperationStatus.FAILED,
        snapshots: [{ courseId: 'c1', applied: false, previous: {}, error: 'NOT_FOUND' }],
      });

      const result = await service.undoBulkOperation('op-1', owner);

      expect(courseRepo.find).not.toHaveBeenCalled();
      expect(courseRepo.save).not.toHaveBeenCalled();
      expect(result.status).toBe(BulkOperationStatus.UNDONE);
    });

    it('admin can undo an operation initiated by someone else', async () => {
      const c1 = makeCourse({ id: 'c1', status: CourseStatus.PUBLISHED });
      bulkOpRepo.findOne.mockResolvedValueOnce({
        id: 'op-1',
        initiatedById: 'instructor-x',
        status: BulkOperationStatus.COMPLETED,
        snapshots: [
          { courseId: 'c1', applied: true, previous: { status: CourseStatus.DRAFT } },
        ],
      });
      courseRepo.find.mockResolvedValueOnce([c1]);

      const result = await service.undoBulkOperation('op-1', admin);

      expect(c1.status).toBe(CourseStatus.DRAFT);
      expect(result.status).toBe(BulkOperationStatus.UNDONE);
    });
  });
});
