import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentsService } from './enrollments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Enrollment } from './entities/enrollment.entity';
import { Course, CourseStatus } from './entities/course.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('EnrollmentsService - Bulk Enroll', () => {
  let service: EnrollmentsService;
  let mockQueryRunner: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        getRepository: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        {
          provide: getRepositoryToken(Enrollment),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Course),
          useValue: {},
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<EnrollmentsService>(EnrollmentsService);
  });

  it('should enroll users and commit transaction on success', async () => {
    const mockEnrollmentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({ id: 'enr1' }),
    };

    const mockCourseRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'c1', status: CourseStatus.PUBLISHED }),
    };

    mockQueryRunner.manager.getRepository.mockImplementation((entity: any) => {
      if (entity === Enrollment) return mockEnrollmentRepo;
      if (entity === Course) return mockCourseRepo;
      return null;
    });

    const result = await service.bulkEnroll([{ userId: 'u1', courseId: 'c1' }]);

    expect(result.enrolled).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('should rollback transaction on partial failure', async () => {
    const mockEnrollmentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({ id: 'enr1' }),
    };

    const mockCourseRepo = {
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 'c1') return Promise.resolve({ id: 'c1', status: CourseStatus.PUBLISHED });
        return Promise.resolve(null); // c2 fails
      }),
    };

    mockQueryRunner.manager.getRepository.mockImplementation((entity: any) => {
      if (entity === Enrollment) return mockEnrollmentRepo;
      if (entity === Course) return mockCourseRepo;
      return null;
    });

    const result = await service.bulkEnroll([
      { userId: 'u1', courseId: 'c1' },
      { userId: 'u2', courseId: 'c2' }, // will fail because course not found
    ]);

    expect(result.enrolled).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
  });
});
