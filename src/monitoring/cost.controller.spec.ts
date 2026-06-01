import { Test, TestingModule } from '@nestjs/testing';
import { CostController } from './cost.controller';
import { CostTrackingService } from './cost-tracking.service';

const mockCostTrackingService = {
  recordHourlyCost: jest.fn(),
  getLast24hCost: jest.fn().mockReturnValue(12.5),
  getAverageHourlyCost: jest.fn().mockReturnValue(0.52),
};

describe('CostController', () => {
  let controller: CostController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CostController],
      providers: [
        { provide: CostTrackingService, useValue: mockCostTrackingService },
      ],
    }).compile();

    controller = module.get<CostController>(CostController);
  });

  it('should record a cost event', async () => {
    await expect(controller.recordCost({ amountUsd: 5 })).resolves.toEqual({ success: true });
    expect(mockCostTrackingService.recordHourlyCost).toHaveBeenCalledWith(5);
  });

  it('should return cost summary', async () => {
    await expect(controller.getCostSummary()).resolves.toEqual({
      last24hUsd: 12.5,
      avgHourlyUsd: 0.52,
    });
    expect(mockCostTrackingService.getLast24hCost).toHaveBeenCalled();
    expect(mockCostTrackingService.getAverageHourlyCost).toHaveBeenCalled();
  });
});
