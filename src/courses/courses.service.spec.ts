import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, Repository } from 'typeorm';
import { CoursesService } from './courses.service';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseReview } from './entities/course-review.entity';
import { CourseVersion, CourseVersionEventType } from './entities/course-version.entity';
import { BulkOperation } from './entities/bulk-operation.entity';
import { User, UserRole } from '../users/entities/user.entity';

const mockCourseRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
};

const mockReviewRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

const mockVersionRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
};

const mockBulkOpRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn((cb: (manager: any) => Promise<any>) => {
    const manager = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Course) return mockCourseRepo;
        if (entity === CourseVersion) return mockVersionRepo;
        if (entity === CourseReview) return mockReviewRepo;
        if (entity === BulkOperation) return mockBulkOpRepo;
        return null;
      }),
    };
    return cb(manager);
  }),
};

const instructor: User = {
  id: 'instr-1',
  role: UserRole.INSTRUCTOR,
} as User;

const baseCourse: Partial<Course> = {
  id: 'course-1',
  title: 'Original title',
  description: 'Original description',
  price: 0,
  thumbnailUrl: 'https://example.com/image.png',
  status: CourseStatus.DRAFT,
  instructorId: 'instr-1',
};

describe('CoursesService', () => {
  let service: CoursesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: getRepositoryToken(Course), useValue: mockCourseRepo },
        { provide: getRepositoryToken(CourseReview), useValue: mockReviewRepo },
        { provide: getRepositoryToken(CourseVersion), useValue: mockVersionRepo },
        { provide: getRepositoryToken(BulkOperation), useValue: mockBulkOpRepo },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a course and snapshot initial version', async () => {
      const dto = { title: 'New course', description: 'A course description.', price: 20 };
      const savedCourse = { ...baseCourse, ...dto };

      mockCourseRepo.create.mockReturnValue(savedCourse);
      mockCourseRepo.save.mockResolvedValue(savedCourse);
      mockVersionRepo.create.mockReturnValue({});
      mockVersionRepo.save.mockResolvedValue({ ...savedCourse, versionNumber: 1 });

      const result = await service.create(dto as any, instructor);

      expect(mockCourseRepo.create).toHaveBeenCalledWith({
        ...dto,
        instructorId: instructor.id,
        status: CourseStatus.DRAFT,
        thumbnailUrl: undefined,
        prerequisite: null,
      });
      expect(mockCourseRepo.save).toHaveBeenCalledWith(savedCourse);
      expect(mockVersionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: savedCourse.id,
          versionNumber: 1,
          eventType: CourseVersionEventType.CREATED,
        }),
      );
      expect(result).toEqual(savedCourse);
    });
  });

  describe('update', () => {
    it('should update a course and create a version snapshot when content changes', async () => {
      const existingCourse = {
        ...baseCourse,
        title: 'Original title',
        description: 'Original description',
      };
      const updatedCourse = { ...existingCourse, title: 'Updated title' };
      const previousVersion = { ...existingCourse, versionNumber: 1 } as CourseVersion;

      mockCourseRepo.findOne.mockResolvedValue(existingCourse);
      mockCourseRepo.save.mockResolvedValue(updatedCourse);
      mockVersionRepo.findOne.mockResolvedValue(previousVersion);
      mockVersionRepo.create.mockReturnValue({});
      mockVersionRepo.save.mockResolvedValue({ ...updatedCourse, versionNumber: 2 });

      const result = await service.update(
        'course-1',
        { title: 'Updated title' } as any,
        instructor,
      );

      expect(result).toEqual(updatedCourse);
      expect(mockVersionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: existingCourse.id,
          versionNumber: 2,
          eventType: CourseVersionEventType.UPDATED,
        }),
      );
    });
  });

  describe('rollbackToVersion', () => {
    it('should rollback to a previous version and create a rollback snapshot', async () => {
      const currentCourse = {
        ...baseCourse,
        title: 'Latest title',
        status: CourseStatus.PUBLISHED,
      };
      const versionEntry = {
        courseId: 'course-1',
        versionNumber: 1,
        title: 'Original title',
        description: 'Original description',
        price: 0,
        thumbnailUrl: 'https://example.com/image.png',
        status: CourseStatus.DRAFT,
        submissionNote: null,
      } as CourseVersion;
      const rolledBackCourse = {
        ...currentCourse,
        title: versionEntry.title,
        status: versionEntry.status,
      };

      mockCourseRepo.findOne.mockResolvedValue(currentCourse);
      mockVersionRepo.findOne.mockResolvedValue(versionEntry);
      mockCourseRepo.save.mockResolvedValue(rolledBackCourse);
      mockVersionRepo.create.mockReturnValue({});
      mockVersionRepo.save.mockResolvedValue({ ...rolledBackCourse, versionNumber: 2 });

      const result = await service.rollbackToVersion('course-1', 1, instructor);

      expect(result.title).toBe('Original title');
      expect(result.status).toBe(CourseStatus.DRAFT);
      expect(mockVersionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: currentCourse.id,
          eventType: CourseVersionEventType.ROLLEDBACK,
        }),
      );
    });
  });

  describe('concurrent updates', () => {
    it('should produce versions 2 and 3 for two sequential updates', async () => {
      const existingCourse = {
        ...baseCourse,
        instructorId: 'instr-1',
      };
      const updated1 = { ...existingCourse, title: 'Update A' };
      const updated2 = { ...existingCourse, title: 'Update B' };

      mockCourseRepo.findOne
        .mockResolvedValueOnce(existingCourse)
        .mockResolvedValueOnce(existingCourse);

      mockCourseRepo.save.mockResolvedValueOnce(updated1).mockResolvedValueOnce(updated2);

      mockVersionRepo.findOne
        .mockResolvedValueOnce({ versionNumber: 1 } as CourseVersion)
        .mockResolvedValueOnce({ versionNumber: 2 } as CourseVersion);

      mockVersionRepo.create.mockReturnValueOnce({}).mockReturnValueOnce({});

      mockVersionRepo.save
        .mockResolvedValueOnce({ versionNumber: 2 })
        .mockResolvedValueOnce({ versionNumber: 3 });

      await service.update('course-1', { title: 'Update A' } as any, instructor);
      await service.update('course-1', { title: 'Update B' } as any, instructor);

      expect(mockVersionRepo.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ versionNumber: 2 }),
      );
      expect(mockVersionRepo.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ versionNumber: 3 }),
      );
    });

    it('should retry once on unique violation and succeed', async () => {
      const existingCourse = {
        ...baseCourse,
        instructorId: 'instr-1',
      };
      const updatedCourse = { ...existingCourse, title: 'Retried update' };

      const uniqueViolationError = new Error('duplicate key value violates unique constraint');
      (uniqueViolationError as any).code = '23505';

      mockCourseRepo.findOne.mockResolvedValue(existingCourse);
      mockCourseRepo.save.mockResolvedValue(updatedCourse);
      mockVersionRepo.findOne.mockResolvedValue({ versionNumber: 1 } as CourseVersion);
      mockVersionRepo.create.mockReturnValue({});

      let saveCallCount = 0;
      mockVersionRepo.save.mockImplementation(() => {
        saveCallCount++;
        if (saveCallCount === 1) {
          return Promise.reject(uniqueViolationError);
        }
        return Promise.resolve({ versionNumber: 2 });
      });

      const result = await service.update(
        'course-1',
        { title: 'Retried update' } as any,
        instructor,
      );

      expect(result).toEqual(updatedCourse);
      expect(mockVersionRepo.save).toHaveBeenCalledTimes(2);
    });
  });
});
