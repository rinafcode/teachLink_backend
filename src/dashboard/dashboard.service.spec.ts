import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Payment } from '../payments/entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { Course } from '../courses/entities/course.entity';
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
});
