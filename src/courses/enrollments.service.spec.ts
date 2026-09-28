import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { OutboxService } from '../common/events/outbox.service';
import { Course, CourseStatus } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { EnrollmentsService } from './enrollments.service';
import { User } from '../users/entities/user.entity';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;

  const enrollmentRepo = {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const courseRepo = {
    findOne: jest.fn(),
  };

  const outbox = {
    enqueue: jest.fn(),
    enqueueStandalone: jest.fn(),
  };

  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Enrollment) return enrollmentRepo;
      if (entity === Course) return courseRepo;
      return null;
    }),
  };

  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };

  const dataSource = {
    transaction: jest.fn(async (cb: any) => cb(manager)),
    createQueryRunner: jest.fn(() => queryRunner),
  };

  const course = (overrides: Partial<Course> = {}): Partial<Course> => ({
    id: 'course-1',
    title: 'Course 1',
    status: CourseStatus.PUBLISHED,
    instructorId: 'instr-1',
    ...overrides,
  });

  const enrollment = (overrides: Partial<Enrollment> = {}): Partial<Enrollment> => ({
    id: 'enr-1',
    userId: 'user-1',
    courseId: 'course-1',
    progress: 0,
    status: 'active',
    ...overrides,
  });

  const user = (id: string, canManage = false): User =>
    ({
      id,
      hasRole: jest.fn().mockReturnValue(canManage),
    }) as unknown as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(Course), useValue: courseRepo },
        { provide: OutboxService, useValue: outbox },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(EnrollmentsService);
    jest.clearAllMocks();
  });

  it('enroll creates an enrollment for a published course', async () => {
    const saved = enrollment({ id: 'enr-1', userId: 'user-1', courseId: 'course-1' });

    courseRepo.findOne.mockResolvedValue(course());
    enrollmentRepo.findOne.mockResolvedValue(null);
    enrollmentRepo.create.mockReturnValue(saved);
    enrollmentRepo.save.mockResolvedValue(saved);

    const result = await service.enroll('user-1', 'course-1');

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(enrollmentRepo.save).toHaveBeenCalledWith(saved);
    expect(result).toEqual(saved);
  });

  it('enroll throws when the course is missing', async () => {
    courseRepo.findOne.mockResolvedValue(null);

    await expect(service.enroll('user-1', 'missing-course')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('bulkEnroll commits successful enrollments', async () => {
    courseRepo.findOne.mockResolvedValue(course());
    enrollmentRepo.findOne.mockResolvedValue(null);
    enrollmentRepo.create.mockImplementation((value) => value);
    enrollmentRepo.save.mockResolvedValue({ id: 'enr-1', userId: 'user-1', courseId: 'course-1' });

    const result = await service.bulkEnroll([{ userId: 'user-1', courseId: 'course-1' }]);

    expect(queryRunner.connect).toHaveBeenCalled();
    expect(queryRunner.startTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result.enrolled).toBe(1);
    expect(outbox.enqueueStandalone).toHaveBeenCalledTimes(2);
  });

  it('getUserEnrollments clamps the requested limit', async () => {
    enrollmentRepo.find.mockResolvedValue([]);

    await service.getUserEnrollments('user-1', 2, 500);

    expect(enrollmentRepo.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      relations: ['course', 'course.instructor'],
      order: { enrolledAt: 'DESC' },
      skip: 100,
      take: 100,
    });
  });

  it('findOne returns the enrollment for the owning user', async () => {
    const record = enrollment({ userId: 'user-1' });
    enrollmentRepo.findOne.mockResolvedValue(record);

    const result = await service.findOne('enr-1', 'user-1');

    expect(result).toBe(record);
  });

  it('findOne throws when a different user requests the enrollment', async () => {
    enrollmentRepo.findOne.mockResolvedValue(enrollment({ userId: 'user-1' }));

    await expect(service.findOne('enr-1', 'other-user')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateProgress marks an enrollment completed at 100%', async () => {
    const record = enrollment({ progress: 25, status: 'active' });

    enrollmentRepo.findOne.mockResolvedValue(record);
    enrollmentRepo.save.mockResolvedValue({ ...record, progress: 100, status: 'completed' });

    const result = await service.updateProgress('enr-1', 100, 'user-1');

    expect(enrollmentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ progress: 100 }));
    expect(outbox.enqueueStandalone).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('completed');
  });

  it('updateProgress rejects decreasing progress', async () => {
    enrollmentRepo.findOne.mockResolvedValue(enrollment({ progress: 50 }));

    await expect(service.updateProgress('enr-1', 40, 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('unenroll removes an active enrollment', async () => {
    enrollmentRepo.findOne.mockResolvedValue(enrollment());
    enrollmentRepo.remove.mockResolvedValue(undefined);

    await service.unenroll('user-1', 'course-1');

    expect(enrollmentRepo.remove).toHaveBeenCalled();
    expect(outbox.enqueueStandalone).toHaveBeenCalledTimes(2);
  });

  it('unenroll throws when the enrollment is missing', async () => {
    enrollmentRepo.findOne.mockResolvedValue(null);

    await expect(service.unenroll('user-1', 'course-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getCourseEnrollments returns rows for the instructor', async () => {
    courseRepo.findOne.mockResolvedValue(course({ instructorId: 'instr-1' }));
    enrollmentRepo.find.mockResolvedValue([enrollment()]);

    const result = await service.getCourseEnrollments('course-1', user('instr-1'));

    expect(result).toHaveLength(1);
    expect(enrollmentRepo.find).toHaveBeenCalledWith({
      where: { courseId: 'course-1' },
      relations: ['user'],
      order: { enrolledAt: 'DESC' },
      skip: 0,
      take: 20,
    });
  });

  it('getCourseEnrollments rejects unauthorized users', async () => {
    courseRepo.findOne.mockResolvedValue(course({ instructorId: 'instr-1' }));

    await expect(
      service.getCourseEnrollments('course-1', user('other-user')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
