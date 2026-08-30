import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayoutsService } from './payouts.service';
import { Course } from '../../courses/entities/course.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Refund, RefundStatus } from '../entities/refund.entity';
import { User } from '../../users/entities/user.entity';
import { InstructorPayoutProfile } from '../entities/payout-profile.entity';
import { InstructorPayout, PayoutStatus } from '../entities/payout.entity';
import { NotificationsService } from '../../notifications/notifications.service';

type QueryBuilderMock = {
  innerJoin: jest.Mock;
  leftJoin: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  groupBy: jest.Mock;
  addGroupBy: jest.Mock;
  orderBy: jest.Mock;
  offset: jest.Mock;
  limit: jest.Mock;
  setParameters: jest.Mock;
  addParameters: jest.Mock;
  getRawMany: jest.Mock;
  getRawOne: jest.Mock;
  getCount: jest.Mock;
  getQuery: jest.Mock;
  getParameters: jest.Mock;
};

const createQueryBuilderMock = (): QueryBuilderMock => ({
  innerJoin: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  setParameters: jest.fn().mockReturnThis(),
  addParameters: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
  getRawOne: jest.fn().mockResolvedValue(undefined),
  getCount: jest.fn().mockResolvedValue(0),
  getQuery: jest.fn().mockReturnValue('SELECT 1'),
  getParameters: jest.fn().mockReturnValue({}),
});

describe('PayoutsService', () => {
  let service: PayoutsService;

  let mockCourseQueryBuilder: QueryBuilderMock;
  let mockPaymentQueryBuilder: QueryBuilderMock;
  let mockRefundQueryBuilder: QueryBuilderMock;

  const mockCourseRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPaymentRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockRefundRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockPayoutProfileRepository = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (profile) => ({ id: 'profile-1', ...profile })),
  };

  const mockPayoutRepository = {
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (payout) => ({ id: 'payout-1', ...payout })),
  };

  const mockNotificationsService = {
    sendTemplated: jest.fn(),
    send: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCourseQueryBuilder = createQueryBuilderMock();
    mockPaymentQueryBuilder = createQueryBuilderMock();
    mockRefundQueryBuilder = createQueryBuilderMock();

    mockCourseRepository.createQueryBuilder.mockReturnValue(mockCourseQueryBuilder);
    mockPaymentRepository.createQueryBuilder.mockReturnValue(mockPaymentQueryBuilder);
    mockRefundRepository.createQueryBuilder.mockReturnValue(mockRefundQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        {
          provide: getRepositoryToken(Course),
          useValue: mockCourseRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(Refund),
          useValue: mockRefundRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(InstructorPayoutProfile),
          useValue: mockPayoutProfileRepository,
        },
        {
          provide: getRepositoryToken(InstructorPayout),
          useValue: mockPayoutRepository,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<PayoutsService>(PayoutsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRevenueBreakdown', () => {
    it('should return empty result with pagination defaults when instructor has no courses', async () => {
      mockCourseQueryBuilder.getCount.mockResolvedValueOnce(0);

      const result = await service.getRevenueBreakdown('inst-1');

      expect(result).toEqual({
        summary: {
          totalGrossRevenue: 0,
          totalRefunds: 0,
          totalNetRevenue: 0,
          currency: 'USD',
        },
        pageInfo: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 0,
        },
        courses: [],
      });
      expect(mockCourseRepository.createQueryBuilder).toHaveBeenCalledWith('course');
      expect(mockCourseQueryBuilder.where).toHaveBeenCalledWith(
        'course.instructorId = :instructorId',
        { instructorId: 'inst-1' },
      );
      expect(mockCourseQueryBuilder.getCount).toHaveBeenCalledTimes(1);
    });

    it('should compute gross, refunds, and net revenue correctly with pagination', async () => {
      mockCourseQueryBuilder.getCount.mockResolvedValueOnce(2);

      mockCourseQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          courseId: 'course-1',
          title: 'Course One',
          gross: '250.00',
          refunds: '25.00',
          salesCount: '2',
        },
        {
          courseId: 'course-2',
          title: 'Course Two',
          gross: '200.00',
          refunds: '0',
          salesCount: '1',
        },
      ]);

      mockPaymentQueryBuilder.getRawOne.mockResolvedValueOnce({
        totalGross: '450.00',
      });
      mockRefundQueryBuilder.getRawOne.mockResolvedValueOnce({
        totalRefunds: '25.00',
      });

      const result = await service.getRevenueBreakdown('inst-1', {
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({
        summary: {
          totalGrossRevenue: 450.0,
          totalRefunds: 25.0,
          totalNetRevenue: 425.0,
          currency: 'USD',
        },
        pageInfo: {
          total: 2,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
        courses: [
          {
            courseId: 'course-1',
            title: 'Course One',
            grossRevenue: 250.0,
            refunds: 25.0,
            netRevenue: 225.0,
            salesCount: 2,
          },
          {
            courseId: 'course-2',
            title: 'Course Two',
            grossRevenue: 200.0,
            refunds: 0.0,
            netRevenue: 200.0,
            salesCount: 1,
          },
        ],
      });

      // Outer QB joins the two pre-aggregated derived subqueries.
      // The outer query has no aggregate columns (sums live in the inner
      // subqueries), so GROUP BY is intentionally omitted — the LEFT JOIN
      // produces one row per course.
      expect(mockCourseQueryBuilder.leftJoin).toHaveBeenCalledTimes(2);
      expect(mockCourseQueryBuilder.select).toHaveBeenCalledWith('course.id', 'courseId');
      expect(mockCourseQueryBuilder.groupBy).not.toHaveBeenCalled();
      expect(mockCourseQueryBuilder.orderBy).toHaveBeenCalledWith('course.title', 'ASC');
      expect(mockCourseQueryBuilder.setParameters).toHaveBeenCalled();
      expect(mockCourseQueryBuilder.offset).toHaveBeenCalledWith(0);
      expect(mockCourseQueryBuilder.limit).toHaveBeenCalledWith(10);

      // Gross subquery was configured against the payments repository.
      expect(mockPaymentQueryBuilder.select).toHaveBeenCalledWith('p.course_id', 'course_id');
      expect(mockPaymentQueryBuilder.where).toHaveBeenCalledWith(
        'p.status = :completedPaymentStatus',
        { completedPaymentStatus: PaymentStatus.COMPLETED },
      );

      // Refunds subquery was configured against the refunds repository.
      expect(mockRefundQueryBuilder.innerJoin).toHaveBeenCalled();
      expect(mockRefundQueryBuilder.where).toHaveBeenCalledWith(
        'r.status = :processedRefundStatus',
        { processedRefundStatus: RefundStatus.PROCESSED },
      );

      // Summary split into two parallel SUM queries.
      expect(mockPaymentQueryBuilder.getRawOne).toHaveBeenCalled();
      expect(mockRefundQueryBuilder.getRawOne).toHaveBeenCalled();
    });

    it('should use the requested pageSize and compute totalPages', async () => {
      mockCourseQueryBuilder.getCount.mockResolvedValueOnce(25);
      mockCourseQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockPaymentQueryBuilder.getRawOne.mockResolvedValueOnce({ totalGross: '0' });
      mockRefundQueryBuilder.getRawOne.mockResolvedValueOnce({ totalRefunds: '0' });

      const result = await service.getRevenueBreakdown('inst-1', {
        page: 3,
        pageSize: 10,
      });

      expect(result.pageInfo).toEqual({
        total: 25,
        page: 3,
        pageSize: 10,
        totalPages: 3,
      });
      expect(mockCourseQueryBuilder.offset).toHaveBeenCalledWith(20);
      expect(mockCourseQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('should clamp pageSize to the maximum when larger values are provided', async () => {
      mockCourseQueryBuilder.getCount.mockResolvedValueOnce(1);
      mockCourseQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockPaymentQueryBuilder.getRawOne.mockResolvedValueOnce({ totalGross: '0' });
      mockRefundQueryBuilder.getRawOne.mockResolvedValueOnce({ totalRefunds: '0' });

      const result = await service.getRevenueBreakdown('inst-1', {
        page: 1,
        pageSize: 10000,
      });

      expect(result.pageInfo.pageSize).toBe(100);
      expect(mockCourseQueryBuilder.limit).toHaveBeenCalledWith(100);
    });

    it('should fall back to defaults for invalid pagination inputs', async () => {
      mockCourseQueryBuilder.getCount.mockResolvedValueOnce(3);
      mockCourseQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockPaymentQueryBuilder.getRawOne.mockResolvedValueOnce({ totalGross: '0' });
      mockRefundQueryBuilder.getRawOne.mockResolvedValueOnce({ totalRefunds: '0' });

      const result = await service.getRevenueBreakdown('inst-1', {
        page: -2,
        pageSize: 0,
      });

      expect(result.pageInfo.page).toBe(1);
      expect(result.pageInfo.pageSize).toBe(10);
    });

    it('should calculate revenue precisely avoiding floating-point rounding errors', async () => {
      mockCourseQueryBuilder.getCount.mockResolvedValueOnce(1);
      mockCourseQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          courseId: 'course-1',
          title: 'Course One',
          gross: '0.30000000000000004',
          refunds: '0.00',
          salesCount: '2',
        },
      ]);
      mockPaymentQueryBuilder.getRawOne.mockResolvedValueOnce({
        totalGross: '0.30000000000000004',
      });
      mockRefundQueryBuilder.getRawOne.mockResolvedValueOnce({ totalRefunds: '0.00' });

      const result = await service.getRevenueBreakdown('inst-1');

      expect(result.summary.totalGrossRevenue).toBe(0.3);
      expect(result.summary.totalNetRevenue).toBe(0.3);
      expect(result.courses[0].grossRevenue).toBe(0.3);
      expect(result.courses[0].netRevenue).toBe(0.3);
    });
  });

  describe('getPayoutProfile', () => {
    it('should return existing profile if found', async () => {
      const existingProfile = {
        id: 'prof-1',
        instructorId: 'inst-1',
        payoutSchedule: 'weekly',
        payoutMethod: 'bank_transfer',
        payoutDetails: 'XYZ Bank',
      };
      mockPayoutProfileRepository.findOne.mockResolvedValue(existingProfile);

      const result = await service.getPayoutProfile('inst-1');

      expect(result).toBe(existingProfile);
      expect(mockPayoutProfileRepository.create).not.toHaveBeenCalled();
    });

    it('should lazily create and return default profile if not found', async () => {
      mockPayoutProfileRepository.findOne.mockResolvedValue(null);

      const result = await service.getPayoutProfile('inst-1');

      expect(result).toEqual({
        id: 'profile-1',
        instructorId: 'inst-1',
        payoutSchedule: 'monthly',
        payoutMethod: 'paypal',
        payoutDetails: '',
      });
      expect(mockPayoutProfileRepository.create).toHaveBeenCalledWith({
        instructorId: 'inst-1',
        payoutSchedule: 'monthly',
        payoutMethod: 'paypal',
        payoutDetails: '',
      });
      expect(mockPayoutProfileRepository.save).toHaveBeenCalled();
    });
  });

  describe('updatePayoutProfile', () => {
    it('should update and save payout profile details', async () => {
      const existingProfile = {
        id: 'prof-1',
        instructorId: 'inst-1',
        payoutSchedule: 'weekly',
        payoutMethod: 'paypal',
        payoutDetails: 'inst@example.com',
      };
      mockPayoutProfileRepository.findOne.mockResolvedValue(existingProfile);
      mockPayoutProfileRepository.save.mockImplementation(async (profile) => profile);

      const updateDto = {
        payoutSchedule: 'monthly',
        payoutMethod: 'bank_transfer',
        payoutDetails: 'bank-routing-details',
      };

      const result = await service.updatePayoutProfile('inst-1', updateDto);

      expect(result.payoutSchedule).toBe('monthly');
      expect(result.payoutMethod).toBe('bank_transfer');
      expect(result.payoutDetails).toBe('bank-routing-details');
      expect(mockPayoutProfileRepository.save).toHaveBeenCalledWith(existingProfile);
    });
  });

  describe('getHistoricalPayouts', () => {
    it('should retrieve payouts sorted by creation date descending', async () => {
      const mockPayouts = [
        { id: 'p-1', instructorId: 'inst-1', amount: 150.0 },
        { id: 'p-2', instructorId: 'inst-1', amount: 200.0 },
      ];
      mockPayoutRepository.find.mockResolvedValue(mockPayouts);

      const result = await service.getHistoricalPayouts('inst-1');

      expect(result).toBe(mockPayouts);
      expect(mockPayoutRepository.find).toHaveBeenCalledWith({
        where: { instructorId: 'inst-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('processPayout', () => {
    it('should create completed payout and attempt sending templated email', async () => {
      const existingProfile = {
        id: 'prof-1',
        instructorId: 'inst-1',
        payoutSchedule: 'monthly',
        payoutMethod: 'paypal',
        payoutDetails: 'instructor@example.com',
      };
      mockPayoutProfileRepository.findOne.mockResolvedValue(existingProfile);

      const mockInstructor = {
        id: 'inst-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'instructor@example.com',
      };
      mockUserRepository.findOne.mockResolvedValue(mockInstructor);

      const result = await service.processPayout('inst-1', 300.0);

      expect(result.id).toBe('payout-1');
      expect(result.amount).toBe(300.0);
      expect(result.status).toBe(PayoutStatus.COMPLETED);
      expect(result.payoutMethod).toBe('paypal');
      expect(result.payoutDetails).toBe('instructor@example.com');

      expect(mockNotificationsService.sendTemplated).toHaveBeenCalledWith({
        userId: 'inst-1',
        templateName: 'instructor_payout',
        eventType: 'payout',
        context: {
          instructorName: 'John Doe',
          amount: '300',
          currency: 'USD',
          payoutMethod: 'paypal',
          payoutDetails: 'instructor@example.com',
        },
      });
      expect(mockNotificationsService.send).not.toHaveBeenCalled();
    });

    it('should send direct fallback notification if templated email fails', async () => {
      const existingProfile = {
        id: 'prof-1',
        instructorId: 'inst-1',
        payoutSchedule: 'monthly',
        payoutMethod: 'paypal',
        payoutDetails: 'instructor@example.com',
      };
      mockPayoutProfileRepository.findOne.mockResolvedValue(existingProfile);

      const mockInstructor = {
        id: 'inst-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'instructor@example.com',
      };
      mockUserRepository.findOne.mockResolvedValue(mockInstructor);

      mockNotificationsService.sendTemplated.mockRejectedValue(new Error('Template render error'));

      const result = await service.processPayout('inst-1', 300.0);

      expect(result.id).toBe('payout-1');
      expect(mockNotificationsService.sendTemplated).toHaveBeenCalled();
      expect(mockNotificationsService.send).toHaveBeenCalledWith({
        userId: 'inst-1',
        title: 'Your payout has been processed!',
        content: expect.stringContaining('Hello John Doe'),
        type: 'email',
      });
    });
  });
});
