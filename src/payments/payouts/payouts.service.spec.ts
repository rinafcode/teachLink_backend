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

describe('PayoutsService', () => {
  let service: PayoutsService;

  const mockQueryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  };

  const mockCourseRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockPaymentRepository = {
    find: jest.fn(),
  };

  const mockRefundRepository = {
    find: jest.fn(),
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
    it('should return empty summary if instructor has no courses', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce(null);

      const result = await service.getRevenueBreakdown('inst-1');

      expect(result).toEqual({
        summary: {
          totalGrossRevenue: 0.0,
          totalRefunds: 0.0,
          totalNetRevenue: 0.0,
          currency: 'USD',
        },
        courses: [],
      });
      expect(mockCourseRepository.createQueryBuilder).toHaveBeenCalledWith('course');
    });

    it('should compute gross, refunds, and net revenue correctly per course', async () => {
      const mockRawCourses = [
        { courseId: 'course-1', title: 'Course One', grossRevenue: '250.00', refunds: '25.00', salesCount: '2' },
        { courseId: 'course-2', title: 'Course Two', grossRevenue: '200.00', refunds: '0.00', salesCount: '1' },
      ];
      const mockSummary = { totalGrossRevenue: '450.00', totalRefunds: '25.00' };

      mockQueryBuilder.getRawMany.mockResolvedValueOnce(mockRawCourses);
      mockQueryBuilder.getRawOne.mockResolvedValueOnce(mockSummary);

      const result = await service.getRevenueBreakdown('inst-1');

      expect(result).toEqual({
        summary: {
          totalGrossRevenue: 450.0,
          totalRefunds: 25.0,
          totalNetRevenue: 425.0,
          currency: 'USD',
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
