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
          useValue: { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(10) },
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: { count: jest.fn().mockResolvedValue(5) },
        },
        {
          provide: getRepositoryToken(Course),
          useValue: { find: jest.fn().mockResolvedValue([]) },
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

  it('should export CSV with headers', async () => {
    const csv = await service.exportToCsv();
    expect(csv).toContain('section,metric,value');
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
        .mockResolvedValueOnce([
          { courseId: 'course-1', courseTitle: 'Course 1', revenue: '100' },
        ])
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
          useValue: { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), createQueryBuilder: jest.fn().mockReturnValue(paymentQueryBuilder) },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(10) },
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
                    lessons: [
                      { videoUrl: 'https://video.example.com/1', durationSeconds: 600 },
                    ],
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
