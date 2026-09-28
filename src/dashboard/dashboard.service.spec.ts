import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Payment } from '../payments/entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { AnalyticsEvent } from '../analytics/entities/event.entity';
import { ReportingService } from '../payments/reporting/reporting.service';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(10),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: { count: jest.fn().mockResolvedValue(5) },
        },
        {
          provide: getRepositoryToken(Course),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoin: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              addGroupBy: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: ReportingService,
          useValue: {
            generateRevenueRecognitionReport: jest.fn().mockResolvedValue({
              grossRevenue: 100,
              netRevenue: 90,
              totalRefunds: 10,
              currency: 'USD',
            }),
          },
        },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('should build conversion funnel', async () => {
    const funnel = await service.getConversionFunnel();
    expect(funnel.stages).toHaveLength(4);
    expect(funnel.stages[0].name).toBe('signup');
  });

  it('should compute user growth metrics from database aggregation', async () => {
    const userQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { period: '2025-01', newUsers: '5' },
        { period: '2025-02', newUsers: '3' },
        { period: '2025-03', newUsers: '8' },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(16),
            createQueryBuilder: jest.fn().mockReturnValue(userQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: { count: jest.fn().mockResolvedValue(5) },
        },
        {
          provide: getRepositoryToken(Course),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoin: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              addGroupBy: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: ReportingService,
          useValue: {
            generateRevenueRecognitionReport: jest.fn().mockResolvedValue({
              grossRevenue: 100,
              netRevenue: 90,
              totalRefunds: 10,
              currency: 'USD',
            }),
          },
        },
      ],
    }).compile();

    const localService = module.get<DashboardService>(DashboardService);
    const result = await localService.getUserGrowthMetrics();

    expect(result.totalUsers).toBe(16);
    expect(result.monthlySignups).toEqual([
      { period: '2025-01', newUsers: 5, totalUsers: 5 },
      { period: '2025-02', newUsers: 3, totalUsers: 8 },
      { period: '2025-03', newUsers: 8, totalUsers: 16 },
    ]);
    expect(userQueryBuilder.select).toHaveBeenCalled();
    expect(userQueryBuilder.addSelect).toHaveBeenCalledWith('COUNT(*)', 'newUsers');
    expect(userQueryBuilder.groupBy).toHaveBeenCalled();
    expect(userQueryBuilder.orderBy).toHaveBeenCalledWith('period', 'ASC');
  });

  it('should return empty monthly signups when no users exist', async () => {
    const userQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            createQueryBuilder: jest.fn().mockReturnValue(userQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: { count: jest.fn().mockResolvedValue(5) },
        },
        {
          provide: getRepositoryToken(Course),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoin: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              addGroupBy: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: ReportingService,
          useValue: {
            generateRevenueRecognitionReport: jest.fn().mockResolvedValue({
              grossRevenue: 100,
              netRevenue: 90,
              totalRefunds: 10,
              currency: 'USD',
            }),
          },
        },
      ],
    }).compile();

    const localService = module.get<DashboardService>(DashboardService);
    const result = await localService.getUserGrowthMetrics();

    expect(result.totalUsers).toBe(0);
    expect(result.monthlySignups).toEqual([]);
  });

  it('should export CSV with headers', async () => {
    const csv = await service.exportToCsv();
    expect(csv).toContain('section,metric,value');
  });

  it('should compute course performance using aggregate query without hydrating enrollments', async () => {
    const courseQueryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          course_id: 'c-1',
          course_title: 'Math',
          course_price: '49.99',
          course_status: 'published',
          enrollmentCount: '100',
        },
        {
          course_id: 'c-2',
          course_title: 'Science',
          course_price: '39.99',
          course_status: 'published',
          enrollmentCount: '50',
        },
        {
          course_id: 'c-3',
          course_title: 'History',
          course_price: '29.99',
          course_status: 'draft',
          enrollmentCount: '0',
        },
      ]),
    };

    const createQueryBuilderSpy = jest.fn().mockReturnValue(courseQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(10),
          },
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: { count: jest.fn().mockResolvedValue(5) },
        },
        {
          provide: getRepositoryToken(Course),
          useValue: { createQueryBuilder: createQueryBuilderSpy },
        },
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: ReportingService,
          useValue: {
            generateRevenueRecognitionReport: jest.fn().mockResolvedValue({
              grossRevenue: 100,
              netRevenue: 90,
              totalRefunds: 10,
              currency: 'USD',
            }),
          },
        },
      ],
    }).compile();

    const localService = module.get<DashboardService>(DashboardService);
    const result = await localService.getCoursePerformanceMetrics();

    expect(createQueryBuilderSpy).toHaveBeenCalledWith('course');
    expect(courseQueryBuilder.leftJoin).toHaveBeenCalledWith('course.enrollments', 'enrollment');
    expect(courseQueryBuilder.addSelect).toHaveBeenCalledWith(
      'COUNT(enrollment.id)',
      'enrollmentCount',
    );
    expect(courseQueryBuilder.take).toHaveBeenCalledWith(20);
    expect(courseQueryBuilder.orderBy).toHaveBeenCalledWith('enrollmentCount', 'DESC');
    expect(courseQueryBuilder.getRawMany).toHaveBeenCalled();

    expect(result).toHaveLength(3);
    expect(result[0].courseId).toBe('c-1');
    expect(result[0].enrollments).toBe(100);
    expect(result[1].courseId).toBe('c-2');
    expect(result[1].enrollments).toBe(50);
    expect(result[2].courseId).toBe('c-3');
    expect(result[2].enrollments).toBe(0);
    expect(result[0].price).toBe(49.99);
  });

  it('should generate instructor dashboard analytics', async () => {
    const paymentQueryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValueOnce([{ totalRevenue: '120', currency: 'USD' }])
        .mockResolvedValueOnce([{ courseId: 'course-1', courseTitle: 'Course 1', revenue: '100' }])
        .mockResolvedValueOnce([{ paymentMethod: 'credit_card', revenue: '120' }]),
    };

    const analyticsQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ courseId: 'course-1', watchSeconds: '200' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            createQueryBuilder: jest.fn().mockReturnValue(paymentQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(10),
          },
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: { count: jest.fn().mockResolvedValue(5) },
        },
        {
          provide: getRepositoryToken(Course),
          useValue: {
            find: jest.fn().mockResolvedValue([
              {
                id: 'course-1',
                title: 'Course 1',
                price: 100,
                status: 'published',
                instructorId: 'instr-1',
                enrollments: [
                  {
                    id: 'enrollment-1',
                    progress: 50,
                    status: 'active',
                    enrolledAt: new Date('2026-05-20T00:00:00Z'),
                  },
                ],
                modules: [
                  {
                    lessons: [{ videoUrl: 'https://video.example.com/1', durationSeconds: 600 }],
                  },
                ],
              },
            ]),
          },
        },
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(analyticsQueryBuilder) },
        },
        {
          provide: ReportingService,
          useValue: {
            generateRevenueRecognitionReport: jest.fn().mockResolvedValue({
              grossRevenue: 100,
              netRevenue: 90,
              totalRefunds: 10,
              currency: 'USD',
            }),
          },
        },
      ],
    }).compile();

    const localService = module.get<DashboardService>(DashboardService);
    const result = await localService.getInstructorDashboard('instr-1');

    expect(result.instructorId).toBe('instr-1');
    expect(result.revenue.totalRevenue).toBe(120);
    expect(result.videoWatchTime.totalWatchSeconds).toBe(200);
    expect(result.completionRate.totalEnrollments).toBe(1);
    expect(result.enrollmentTrends).toHaveLength(30);
  });
});
