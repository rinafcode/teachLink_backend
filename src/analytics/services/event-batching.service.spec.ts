import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventBatchingService } from './event-batching.service';
import { AnalyticsEvent, EventType } from '../entities/event.entity';

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    eventType: EventType.CUSTOM,
    category: 'c',
    action: 'a',
    ...overrides,
  } as AnalyticsEvent;
}

describe('EventBatchingService', () => {
  let service: EventBatchingService;
  let repo: jest.Mocked<Repository<AnalyticsEvent>>;
  const originalBatchSize = process.env.EVENT_BATCH_SIZE;
  const originalFlushInterval = process.env.EVENT_FLUSH_INTERVAL_MS;

  async function buildService(): Promise<void> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBatchingService,
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: { insert: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<EventBatchingService>(EventBatchingService);
    repo = module.get(getRepositoryToken(AnalyticsEvent));
  }

  afterEach(() => {
    jest.useRealTimers();
    process.env.EVENT_BATCH_SIZE = originalBatchSize;
    process.env.EVENT_FLUSH_INTERVAL_MS = originalFlushInterval;
  });

  describe('addEvent', () => {
    beforeEach(async () => {
      process.env.EVENT_BATCH_SIZE = '3';
      await buildService();
    });

    it('adds an event to the batch without flushing below the batch size', () => {
      service.addEvent(makeEvent());
      expect(service.getBatchSize()).toBe(1);
      expect(repo.insert).not.toHaveBeenCalled();
    });

    it('flushes automatically once the batch reaches BATCH_SIZE', async () => {
      service.addEvent(makeEvent());
      service.addEvent(makeEvent());
      service.addEvent(makeEvent());

      // flushBatch() is fire-and-forget from addEvent — allow its microtask to settle.
      await Promise.resolve();
      await Promise.resolve();

      expect(repo.insert).toHaveBeenCalledTimes(1);
      expect(repo.insert).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Object)]));
      expect(service.getBatchSize()).toBe(0);
    });

    it('discards events received after shutdown has begun', () => {
      service.onModuleDestroy();
      service.addEvent(makeEvent());

      expect(service.getBatchSize()).toBe(0);
    });
  });

  describe('forceFlush', () => {
    beforeEach(async () => {
      process.env.EVENT_BATCH_SIZE = '100';
      await buildService();
    });

    it('persists all pending events and clears the batch', async () => {
      service.addEvent(makeEvent({ category: 'a' }));
      service.addEvent(makeEvent({ category: 'b' }));

      await service.forceFlush();

      expect(repo.insert).toHaveBeenCalledTimes(1);
      expect(repo.insert).toHaveBeenCalledWith([
        expect.objectContaining({ category: 'a' }),
        expect.objectContaining({ category: 'b' }),
      ]);
      expect(service.getBatchSize()).toBe(0);
    });

    it('is a no-op when the batch is empty', async () => {
      await service.forceFlush();
      expect(repo.insert).not.toHaveBeenCalled();
    });

    it('re-queues events (up to the retry limit) and rethrows on a failed flush', async () => {
      const error = new Error('insert failed');
      repo.insert.mockRejectedValueOnce(error);
      service.addEvent(makeEvent());

      await expect(service.forceFlush()).rejects.toThrow(error);
      expect(service.getBatchSize()).toBe(1);
    });
  });

  describe('onModuleInit / onModuleDestroy', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      process.env.EVENT_BATCH_SIZE = '100';
      process.env.EVENT_FLUSH_INTERVAL_MS = '1000';
      await buildService();
    });

    it('periodically flushes any pending events on the configured interval', async () => {
      service.onModuleInit();
      service.addEvent(makeEvent());

      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(repo.insert).toHaveBeenCalledTimes(1);
    });

    it('does not flush on the interval when the batch is empty', () => {
      service.onModuleInit();

      jest.advanceTimersByTime(1000);

      expect(repo.insert).not.toHaveBeenCalled();
    });

    it('stops the interval and performs a final flush of pending events', async () => {
      service.onModuleInit();
      service.addEvent(makeEvent());

      await service.onModuleDestroy();

      expect(repo.insert).toHaveBeenCalledTimes(1);

      // Interval must be cleared — advancing time should not trigger another flush.
      service.addEvent(makeEvent());
      jest.advanceTimersByTime(5000);
      expect(repo.insert).toHaveBeenCalledTimes(1);
    });

    it('returns undefined synchronously on destroy when there is nothing to flush', () => {
      service.onModuleInit();

      expect(service.onModuleDestroy()).toBeUndefined();
      expect(repo.insert).not.toHaveBeenCalled();
    });
  });
});
