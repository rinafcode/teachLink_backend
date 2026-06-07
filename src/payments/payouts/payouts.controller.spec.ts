import { Test, TestingModule } from '@nestjs/testing';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { PayoutStatus } from '../entities/payout.entity';

describe('PayoutsController', () => {
  let controller: PayoutsController;
  let service: PayoutsService;

  const mockPayoutsService = {
    getRevenueBreakdown: jest.fn(),
    getPayoutProfile: jest.fn(),
    updatePayoutProfile: jest.fn(),
    getHistoricalPayouts: jest.fn(),
    processPayout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayoutsController],
      providers: [
        {
          provide: PayoutsService,
          useValue: mockPayoutsService,
        },
      ],
    }).compile();

    controller = module.get<PayoutsController>(PayoutsController);
    service = module.get<PayoutsService>(PayoutsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRevenueBreakdown', () => {
    it('should delegate to service using instructor ID from request', async () => {
      const mockResult = { summary: { totalGrossRevenue: 100.0 }, courses: [] };
      mockPayoutsService.getRevenueBreakdown.mockResolvedValue(mockResult);

      const mockRequest = { user: { id: 'instructor-123' } };
      const result = await controller.getRevenueBreakdown(mockRequest);

      expect(result).toBe(mockResult);
      expect(mockPayoutsService.getRevenueBreakdown).toHaveBeenCalledWith('instructor-123');
    });
  });

  describe('getPayoutProfile', () => {
    it('should delegate to service to fetch settings', async () => {
      const mockProfile = { id: 'prof-1', instructorId: 'inst-123', payoutSchedule: 'monthly' };
      mockPayoutsService.getPayoutProfile.mockResolvedValue(mockProfile);

      const mockRequest = { user: { id: 'inst-123' } };
      const result = await controller.getPayoutProfile(mockRequest);

      expect(result).toBe(mockProfile);
      expect(mockPayoutsService.getPayoutProfile).toHaveBeenCalledWith('inst-123');
    });
  });

  describe('updatePayoutProfile', () => {
    it('should delegate to service to save new settings', async () => {
      const mockUpdated = { id: 'prof-1', payoutSchedule: 'weekly' };
      mockPayoutsService.updatePayoutProfile.mockResolvedValue(mockUpdated);

      const dto = {
        payoutSchedule: 'weekly',
        payoutMethod: 'paypal',
        payoutDetails: 'inst@example.com',
      };
      const mockRequest = { user: { id: 'inst-123' } };
      const result = await controller.updatePayoutProfile(mockRequest, dto);

      expect(result).toBe(mockUpdated);
      expect(mockPayoutsService.updatePayoutProfile).toHaveBeenCalledWith('inst-123', dto);
    });
  });

  describe('getHistoricalPayouts', () => {
    it('should delegate to service to fetch payout history', async () => {
      const mockPayouts = [{ id: 'p-1', amount: 100.0, status: PayoutStatus.COMPLETED }];
      mockPayoutsService.getHistoricalPayouts.mockResolvedValue(mockPayouts);

      const mockRequest = { user: { id: 'inst-123' } };
      const result = await controller.getHistoricalPayouts(mockRequest);

      expect(result).toBe(mockPayouts);
      expect(mockPayoutsService.getHistoricalPayouts).toHaveBeenCalledWith('inst-123');
    });
  });

  describe('processPayout', () => {
    it('should delegate to service to trigger payout processing', async () => {
      const mockProcessed = { id: 'payout-1', amount: 150.0 };
      mockPayoutsService.processPayout.mockResolvedValue(mockProcessed);

      const dto = {
        instructorId: 'inst-555',
        amount: 150.0,
      };
      const result = await controller.processPayout(dto);

      expect(result).toBe(mockProcessed);
      expect(mockPayoutsService.processPayout).toHaveBeenCalledWith('inst-555', 150.0);
    });
  });
});
