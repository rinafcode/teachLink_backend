import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent, EventType } from './entities/event.entity';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { EventBatchingService } from './services/event-batching.service';
import { EventValidationService } from './services/event-validation.service';

// Minimal prom-client registry stub used by onModuleInit
const fakeRegistry = {
  getSingleMetric: jest.fn().mockReturnValue(undefined),
};

const mockMetrics = {
  getRegistry: jest.fn().mockReturnValue(fakeRegistry),
};

const mockBatchingService = {
  addEvent: jest.fn(),
};

const mockValidationService = {
  validateEventOrThrow: jest.fn(),
};

// Query builder chain used by getEvents / getAnalyticsSummary
const buildQb = (overrides: Record<string, any> = {}) => {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return qb;
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let eventRepo: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    eventRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(buildQb()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(AnalyticsEvent), useValue: eventRepo },
        { provide: MetricsCollectionService, useValue: mockMetrics },
        { provide: EventBatchingService, useValue: mockBatchingService },
        { provide: EventValidationService, useValue: mockValidationService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  // ── trackEvent ───────────────────────────────────────────────────────────

  describe('trackEvent', () => {
    const dto = {
      eventType: EventType.CUSTOM,
      category: 'feature',
      action: 'click',
    };

    it('validates and batches valid events', async () => {
      mockValidationService.validateEventOrThrow.mockReturnValue(undefined);

      await service.trackEvent(dto);

      expect(mockValidationService.validateEventOrThrow).toHaveBeenCalledWith(dto);
      expect(mockBatchingService.addEvent).toHaveBeenCalled();
    });

    it('re-throws BadRequestException from validation', async () => {
      mockValidationService.validateEventOrThrow.mockImplementation(() => {
        throw new BadRequestException('invalid');
      });

      await expect(service.trackEvent(dto)).rejects.toThrow(BadRequestException);
      expect(mockBatchingService.addEvent).not.toHaveBeenCalled();
    });

    it('wraps unexpected errors in BadRequestException', async () => {
      mockValidationService.validateEventOrThrow.mockImplementation(() => {
        throw new Error('unexpected');
      });

      await expect(service.trackEvent(dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ── recordEvent ──────────────────────────────────────────────────────────

  describe('recordEvent', () => {
    it('does not throw when counter is null', () => {
      // counter is null until onModuleInit runs, which we skip here
      expect(() => service.recordEvent('cat', 'action')).not.toThrow();
    });
  });

  // ── recordAssessmentStarted / Submitted / TimedOut / Score ───────────────

  describe('assessment helpers', () => {
    it('recordAssessmentStarted does not throw', () => {
      expect(() => service.recordAssessmentStarted('assess-1')).not.toThrow();
    });

    it('recordAssessmentSubmitted does not throw', () => {
      expect(() => service.recordAssessmentSubmitted('assess-1', new Date())).not.toThrow();
    });

    it('recordAssessmentTimedOut does not throw', () => {
      expect(() => service.recordAssessmentTimedOut('assess-1', new Date())).not.toThrow();
    });

    it('recordAssessmentScore does not throw', () => {
      expect(() => service.recordAssessmentScore(80, 100)).not.toThrow();
    });

    it('recordAssessmentScore handles zero maxScore gracefully', () => {
      expect(() => service.recordAssessmentScore(0, 0)).not.toThrow();
    });
  });

  // ── getEvents ────────────────────────────────────────────────────────────

  describe('getEvents', () => {
    it('returns empty result set when no events exist', async () => {
      const qb = buildQb({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) });
      eventRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getEvents({});

      expect(result.events).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('applies all optional filters when provided', async () => {
      const events = [{ id: 'ev-1' } as AnalyticsEvent];
      const qb = buildQb({ getManyAndCount: jest.fn().mockResolvedValue([events, 1]) });
      eventRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getEvents({
        eventType: EventType.CUSTOM,
        userId: 'user-1',
        category: 'feature',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(qb.andWhere).toHaveBeenCalled();
    });
  });

  // ── getAnalyticsSummary ──────────────────────────────────────────────────

  describe('getAnalyticsSummary', () => {
    it('returns zeroed summary when no events exist', async () => {
      const qb = buildQb({
        getCount: jest.fn().mockResolvedValue(0),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      eventRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAnalyticsSummary(
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      expect(result.totalEvents).toBe(0);
      expect(result.eventsByType).toEqual({});
      expect(result.eventsByCategory).toEqual({});
      expect(result.topActions).toEqual([]);
    });

    it('maps raw query results into summary shape', async () => {
      const qbCount = buildQb({ getCount: jest.fn().mockResolvedValue(5) });
      const qbByType = buildQb({
        getRawMany: jest.fn().mockResolvedValue([{ type: EventType.CUSTOM, count: 5 }]),
      });
      const qbByCategory = buildQb({
        getRawMany: jest.fn().mockResolvedValue([{ category: 'feature', count: 5 }]),
      });
      const qbTopActions = buildQb({
        getRawMany: jest.fn().mockResolvedValue([{ action: 'click', count: 5 }]),
      });

      eventRepo.createQueryBuilder
        .mockReturnValueOnce(qbCount)
        .mockReturnValueOnce(qbByType)
        .mockReturnValueOnce(qbByCategory)
        .mockReturnValueOnce(qbTopActions);

      const result = await service.getAnalyticsSummary(
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      expect(result.totalEvents).toBe(5);
      expect(result.eventsByType[EventType.CUSTOM]).toBe(5);
      expect(result.eventsByCategory['feature']).toBe(5);
      expect(result.topActions[0].action).toBe('click');
    });
  });
});
