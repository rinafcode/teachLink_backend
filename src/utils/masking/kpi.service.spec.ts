import { Test, TestingModule } from '@nestjs/testing';
import { KpiService } from './kpi.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course } from '../../courses/entities/course.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { User } from '../../users/entities/user.entity';
import { MetricsService } from '../../observability/metrics.service';

describe('KpiService', () => {
  let service: KpiService;
  let mockCourseRepository: any;
  let mockEnrollmentRepository: any;
  let mockUserRepository: any;
  let mockMetricsService: any;

  beforeEach(async () => {
    mockCourseRepository = {
      find: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    };

    mockEnrollmentRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ courseId: 1, count: '5' }]),
      }),
    };

    mockUserRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '10' }),
      }),
    };

    mockMetricsService = {
      recordMetric: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KpiService,
        { provide: getRepositoryToken(Course), useValue: mockCourseRepository },
        { provide: getRepositoryToken(Enrollment), useValue: mockEnrollmentRepository },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    service = module.get<KpiService>(KpiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculateEnrollmentConversionRate should issue a constant number of queries regardless of course count', async () => {
    await service.calculateEnrollmentConversionRate();
    
    // Assert that find is called once for courses
    expect(mockCourseRepository.find).toHaveBeenCalledTimes(1);
    
    // Assert that createQueryBuilder (for grouping) is called exactly once, 
    // regardless of the 2 courses returned.
    expect(mockEnrollmentRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    
    // Verify metric was recorded
    expect(mockMetricsService.recordMetric).toHaveBeenCalledWith('kpi_job_duration_ms', expect.any(Number));
  });

  it('calculateUserRetention should not load individual user rows', async () => {
    await service.calculateUserRetention('2023-01');
    
    expect(mockUserRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(mockMetricsService.recordMetric).toHaveBeenCalledWith('kpi_job_duration_ms', expect.any(Number));
  });
});
