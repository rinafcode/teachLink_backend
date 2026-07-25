import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventType } from './entities/event.entity';

const mockAnalyticsService = {
  trackEvent: jest.fn(),
  getEvents: jest.fn(),
  getAnalyticsSummary: jest.fn(),
};

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: mockAnalyticsService }],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('should record a compatibility analytics event on POST /analytics/event', async () => {
    const dto: CreateEventDto = {
      category: 'feature',
      action: 'launch_button_clicked',
    };

    const req = {
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('super-agent'),
    } as any;

    await expect(controller.trackEventCompatibility(dto, req)).resolves.toEqual({ success: true });
    expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith({
      ...dto,
      eventType: EventType.CUSTOM,
      userId: undefined,
      ipAddress: '127.0.0.1',
      userAgent: 'super-agent',
    });
  });
});
