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
    groupBy: jest.fn().mockReturnThis(),
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
