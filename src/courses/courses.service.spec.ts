import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoursesService } from './courses.service';
import { Course, CourseStatus } from './entities/course.entity';
import { CourseReview } from './entities/course-review.entity';
import { CourseVersion, CourseVersionEventType } from './entities/course-version.entity';
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
      mockVersionRepo.findOne.mockResolvedValue(null);
      mockVersionRepo.create.mockReturnValue({});
      mockVersionRepo.save.mockResolvedValue({ ...savedCourse, versionNumber: 1 });

      const result = await service.create(dto as any, instructor);

      expect(mockCourseRepo.create).toHaveBeenCalledWith({
        ...dto,
        instructorId: instructor.id,
        status: CourseStatus.DRAFT,
      });
      expect(mockCourseRepo.save).toHaveBeenCalledWith(savedCourse);
      expect(mockVersionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        courseId: savedCourse.id,
        versionNumber: 1,
        eventType: CourseVersionEventType.CREATED,
      }));
      expect(result).toEqual(savedCourse);
    });
  });

  describe('update', () => {
    it('should update a course and create a version snapshot when content changes', async () => {
      const existingCourse = { ...baseCourse, title: 'Original title', description: 'Original description' };
      const updatedCourse = { ...existingCourse, title: 'Updated title' };
      const previousVersion = { ...existingCourse, versionNumber: 1 } as CourseVersion;

      mockCourseRepo.findOne.mockResolvedValue(existingCourse);
      mockCourseRepo.save.mockResolvedValue(updatedCourse);
      mockVersionRepo.findOne.mockResolvedValue(previousVersion);
      mockVersionRepo.create.mockReturnValue({});
      mockVersionRepo.save.mockResolvedValue({ ...updatedCourse, versionNumber: 2 });

      const result = await service.update('course-1', { title: 'Updated title' } as any, instructor);

      expect(result).toEqual(updatedCourse);
      expect(mockVersionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        courseId: existingCourse.id,
        versionNumber: 2,
        eventType: CourseVersionEventType.UPDATED,
      }));
    });
  });

  describe('rollbackToVersion', () => {
    it('should rollback to a previous version and create a rollback snapshot', async () => {
      const currentCourse = { ...baseCourse, title: 'Latest title', status: CourseStatus.PUBLISHED };
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
      const rolledBackCourse = { ...currentCourse, title: versionEntry.title, status: versionEntry.status };

      mockCourseRepo.findOne.mockResolvedValue(currentCourse);
      mockVersionRepo.findOne.mockResolvedValue(versionEntry);
      mockCourseRepo.save.mockResolvedValue(rolledBackCourse);
      mockVersionRepo.create.mockReturnValue({});
      mockVersionRepo.save.mockResolvedValue({ ...rolledBackCourse, versionNumber: 2 });

      const result = await service.rollbackToVersion('course-1', 1, instructor);

      expect(result.title).toBe('Original title');
      expect(result.status).toBe(CourseStatus.DRAFT);
      expect(mockVersionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        courseId: currentCourse.id,
        eventType: CourseVersionEventType.ROLLEDBACK,
      }));
    });
  });
});
