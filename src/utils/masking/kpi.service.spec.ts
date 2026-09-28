import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KpiService } from './kpi.service';
import { MetricsService } from './metrics.service';
import { User } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { AnalyticsEvent } from '../../analytics/entities/event.entity';
import { Repository } from 'typeorm';

describe('KpiService', () => {
  let kpiService: KpiService;
  let metricsService: MetricsService;

  const mockQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  };

  const mockRepo = {
    count: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQb),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KpiService,
        MetricsService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: getRepositoryToken(Course), useValue: mockRepo },
        { provide: getRepositoryToken(Enrollment), useValue: mockRepo },
        { provide: getRepositoryToken(Payment), useValue: mockRepo },
        { provide: getRepositoryToken(Event), useValue: mockRepo },
      ],
    }).compile();

    kpiService = module.get<KpiService>(KpiService);
    metricsService = module.get<MetricsService>(MetricsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(kpiService).toBeDefined();
  });

  describe('calculateActiveUsers', () => {
    it('should set active user gauges', async () => {
      mockQb.getRawOne
        .mockResolvedValueOnce({ count: '10' })
        .mockResolvedValueOnce({ count: '50' })
        .mockResolvedValueOnce({ count: '200' });
      const gaugeSpy = jest.spyOn(metricsService.activeUsersGauge, 'set');

      await kpiService.calculateActiveUsers();

      expect(gaugeSpy).toHaveBeenCalledWith(expect.any(Object), 10);
      expect(gaugeSpy).toHaveBeenCalledWith(expect.any(Object), 50);
      expect(gaugeSpy).toHaveBeenCalledWith(expect.any(Object), 200);
    });
  });

  describe('calculatePaymentSuccessRate', () => {
    it('should set payment success rate gauge', async () => {
      const gaugeSpy = jest.spyOn(metricsService.paymentSuccessRateGauge, 'set');
      jest.spyOn(mockRepo, 'count').mockImplementation((options: any) => {
        if (options.where.status === PaymentStatus.COMPLETED) return Promise.resolve(95);
        if (options.where.status === PaymentStatus.FAILED) return Promise.resolve(5);
        return Promise.resolve(0);
      });

      await kpiService.calculatePaymentSuccessRate();

      expect(gaugeSpy).toHaveBeenCalledWith(95);
    });

    it('should handle zero total payments', async () => {
      const gaugeSpy = jest.spyOn(metricsService.paymentSuccessRateGauge, 'set');
      jest.spyOn(mockRepo, 'count').mockResolvedValue(0);

      await kpiService.calculatePaymentSuccessRate();

      expect(gaugeSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('calculateRevenuePerCourse', () => {
    it('should set revenue per course gauge', async () => {
      const revenueData = [
        { courseId: 'c1', courseName: 'Course 1', totalRevenue: '1000' },
        { courseId: 'c2', courseName: 'Course 2', totalRevenue: '2500' },
      ];
      mockQb.getRawMany.mockResolvedValue(revenueData);
      const gaugeSpy = jest.spyOn(metricsService.revenuePerCourseGauge, 'set');

      await kpiService.calculateRevenuePerCourse();

      expect(gaugeSpy).toHaveBeenCalledWith(expect.any(Object), 1000);
      expect(gaugeSpy).toHaveBeenCalledWith(expect.any(Object), 2500);
    });
  });

  describe('calculateUserRetention', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2025-04-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should compute retention from grouped aggregates without find() or IN-lists', async () => {
      mockQb.getRawMany.mockReset();
      mockQb.getRawMany
        .mockResolvedValueOnce([
          { cohort_month: '2025-01', cohort_size: '100' },
          { cohort_month: '2025-02', cohort_size: '50' },
          { cohort_month: '2025-03', cohort_size: '200' },
        ])
        .mockResolvedValueOnce([
          { cohort_month: '2025-01', retained_month: '2025-02', retained_count: '40' },
          { cohort_month: '2025-01', retained_month: '2025-03', retained_count: '20' },
        ]);

      const setMock = jest.fn();
      const labelsSpy = jest
        .spyOn(metricsService.userRetentionGauge, 'labels')
        .mockReturnValue({ set: setMock } as any);

      await kpiService.calculateUserRetention();

      expect(mockRepo.find).not.toHaveBeenCalled();
      expect(mockRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockQb.innerJoin).toHaveBeenCalled();
      expect(mockQb.groupBy).toHaveBeenCalled();

      const whereCalls = [...mockQb.where.mock.calls, ...mockQb.andWhere.mock.calls].map(
        (args) => String(args[0]),
      );
      expect(whereCalls.join(' ')).not.toMatch(/IN\s*\(/i);

      // 40/100*100=40, 20/100*100=20 for the mocked cohort pair
      expect(setMock).toHaveBeenCalledWith(40);
      expect(setMock).toHaveBeenCalledWith(20);
      labelsSpy.mockRestore();
    });

    it('should report 0 when a retention bucket has no events and skip empty cohorts', async () => {
      mockQb.getRawMany.mockReset();
      mockQb.getRawMany
        .mockResolvedValueOnce([
          { cohort_month: '2025-01', cohort_size: '100' },
          // second cohort intentionally missing (empty) to verify skip
        ])
        .mockResolvedValueOnce([]);

      const setMock = jest.fn();
      const labelsSpy = jest
        .spyOn(metricsService.userRetentionGauge, 'labels')
        .mockReturnValue({ set: setMock } as any);

      await kpiService.calculateUserRetention();

      expect(mockRepo.find).not.toHaveBeenCalled();
      // Missing retention rows resolve to 0% rather than missing gauges
      expect(setMock).toHaveBeenCalledWith(0);
      labelsSpy.mockRestore();
    });
  });

  describe('handleCron', () => {
    it('should call all calculation methods', async () => {
      const activeUsersSpy = jest
        .spyOn(kpiService, 'calculateActiveUsers')
        .mockResolvedValue(undefined);
      const paymentSpy = jest
        .spyOn(kpiService, 'calculatePaymentSuccessRate')
        .mockResolvedValue(undefined);
      const revenueSpy = jest
        .spyOn(kpiService, 'calculateRevenuePerCourse')
        .mockResolvedValue(undefined);
      const enrollmentSpy = jest
        .spyOn(kpiService, 'calculateEnrollmentConversionRate')
        .mockResolvedValue(undefined);
      const retentionSpy = jest
        .spyOn(kpiService, 'calculateUserRetention')
        .mockResolvedValue(undefined);

      await kpiService.handleCron();

      expect(activeUsersSpy).toHaveBeenCalled();
      expect(paymentSpy).toHaveBeenCalled();
      expect(revenueSpy).toHaveBeenCalled();
      expect(enrollmentSpy).toHaveBeenCalled();
      expect(retentionSpy).toHaveBeenCalled();
    });
  });
});
