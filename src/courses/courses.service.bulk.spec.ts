import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ResourceNotFoundException,
  ForbiddenOperationException,
} from '../common/exceptions/app.exceptions';

import { CoursesService } from './courses.service';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseReview } from './entities/course-review.entity';
import { CourseVersion } from './entities/course-version.entity';
import {
  BulkOperation,
  BulkOperationStatus,
  BulkOperationType,
} from './entities/bulk-operation.entity';
import { User } from '../users/entities/user.entity';

describe('CoursesService - Bulk Operations', () => {
  let service: CoursesService;

  const courseRepo = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const bulkOpRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const owner = {
    id: 'instructor-1',
    roles: [],
  } as unknown as User;

  const admin = {
    id: 'admin-1',
    roles: [{ name: 'admin' }],
  } as unknown as User;

  const createCourse = (overrides: Partial<Course> = {}): Course =>
    ({
      id: 'course-1',
      title: 'Test Course',
      description: 'Description',
      price: 10,
      status: CourseStatus.DRAFT,
      instructorId: 'instructor-1',
      category: undefined,
      ...overrides,
    }) as Course;

  beforeEach(async () => {
    jest.resetAllMocks();

    courseRepo.save.mockImplementation(async (data) => data);

    bulkOpRepo.create.mockImplementation((data) => data);
    bulkOpRepo.save.mockImplementation(async (data) => ({
      id: 'op-1',
      ...data,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: getRepositoryToken(Course),
          useValue: courseRepo,
        },
        {
          provide: getRepositoryToken(CourseReview),
          useValue: {},
        },
        {
          provide: getRepositoryToken(CourseVersion),
          useValue: {},
        },
        {
          provide: getRepositoryToken(BulkOperation),
          useValue: bulkOpRepo,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get(CoursesService);
  });

  describe('bulkPublish', () => {
    it('should publish all eligible courses', async () => {
      const courses = [createCourse({ id: 'c1' }), createCourse({ id: 'c2' })];

      courseRepo.find.mockResolvedValue(courses);

      const result = await service.bulkPublish(
        {
          courseIds: ['c1', 'c2'],
          publish: true,
        },
        owner,
      );

      expect(courseRepo.save).toHaveBeenCalledWith(courses);

      expect(result).toMatchObject({
        type: BulkOperationType.PUBLISH,
        status: BulkOperationStatus.COMPLETED,
        successCount: 2,
        failureCount: 0,
      });

      expect(courses.every((course) => course.status === CourseStatus.PUBLISHED)).toBe(true);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    });

    it('should return FAILED when no courses are found', async () => {
      courseRepo.find.mockResolvedValue([]);

      const result = await service.bulkPublish(
        {
          courseIds: ['missing'],
          publish: true,
        },
        owner,
      );

      expect(result.status).toBe(BulkOperationStatus.FAILED);

      expect(courseRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('undoBulkOperation', () => {
    it('should restore all snapshot values', async () => {
      const course = createCourse({
        id: 'c1',
        status: CourseStatus.PUBLISHED,
        price: 100,
        category: 'new',
      });

      bulkOpRepo.findOne.mockResolvedValue({
        id: 'op-1',
        initiatedById: owner.id,
        status: BulkOperationStatus.COMPLETED,
        snapshots: [
          {
            courseId: 'c1',
            applied: true,
            previous: {
              status: CourseStatus.DRAFT,
              price: 10,
              category: 'old',
            },
          },
        ],
      });

      courseRepo.find.mockResolvedValue([course]);

      const result = await service.undoBulkOperation('op-1', owner);

      expect(course.status).toBe(CourseStatus.DRAFT);
      expect(course.price).toBe(10);
      expect(course.category).toBe('old');

      expect(courseRepo.save).toHaveBeenCalledWith([course]);

      expect(result.status).toBe(BulkOperationStatus.UNDONE);
    });

    it('should throw when operation does not exist', async () => {
      bulkOpRepo.findOne.mockResolvedValue(null);

      await expect(service.undoBulkOperation('missing', owner)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('should reject unauthorized users', async () => {
      bulkOpRepo.findOne.mockResolvedValue({
        id: 'op-1',
        initiatedById: owner.id,
        status: BulkOperationStatus.COMPLETED,
        snapshots: [],
      });

      await expect(
        service.undoBulkOperation('op-1', {
          id: 'other-user',
          roles: [],
        } as unknown as User),
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it('should allow admins to undo operations', async () => {
      const course = createCourse({
        id: 'c1',
        status: CourseStatus.PUBLISHED,
      });

      bulkOpRepo.findOne.mockResolvedValue({
        id: 'op-1',
        initiatedById: 'someone-else',
        status: BulkOperationStatus.COMPLETED,
        snapshots: [
          {
            courseId: 'c1',
            applied: true,
            previous: {
              status: CourseStatus.DRAFT,
            },
          },
        ],
      });

      courseRepo.find.mockResolvedValue([course]);

      const result = await service.undoBulkOperation('op-1', admin);

      expect(result.status).toBe(BulkOperationStatus.UNDONE);
    });
  });
});
