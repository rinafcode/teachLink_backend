import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryEvent } from 'typeorm';
import { Logger } from '@nestjs/common';
import { DbMetricsSubscriber } from './db-metrics.subscriber';
import { MetricsCollectionService } from './metrics-collection.service';
import { runWithCorrelationId } from '../../common/utils/correlation.utils';

describe('DbMetricsSubscriber', () => {
  let subscriber: DbMetricsSubscriber;
  let mockDataSource: any;
  let metricsService: MetricsCollectionService;

  beforeEach(async () => {
    process.env.DATABASE_POOL_SLOW_QUERY_THRESHOLD_MS = '100';
    mockDataSource = {
      subscribers: [],
    };

    metricsService = new MetricsCollectionService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbMetricsSubscriber,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: MetricsCollectionService,
          useValue: metricsService,
        },
      ],
    }).compile();

    subscriber = module.get<DbMetricsSubscriber>(DbMetricsSubscriber);
    subscriber.onModuleInit();
  });

  it('should register subscriber to the datasource', () => {
    expect(mockDataSource.subscribers).toContain(subscriber);
  });

  it('should record normal database query metrics and not flag slow', async () => {
    const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const event = {
      query: 'SELECT * FROM users WHERE id = $1',
      parameters: [1],
      connection: {} as any,
    } as QueryEvent<any>;

    subscriber.beforeQuery(event);
    subscriber.afterQuery(event);

    const metricsStr = await metricsService.getMetrics();
    expect(metricsStr).toContain('db_query_duration_seconds');
    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });

  it('should flag slow query, log warning, and record slow query metric', async () => {
    const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const event = {
      query: 'SELECT * FROM courses',
      parameters: [],
      connection: {} as any,
    } as QueryEvent<any>;

    await runWithCorrelationId(async () => {
      subscriber.beforeQuery(event);

      // Artificially wait to make query slow (> 100ms)
      await new Promise((resolve) => setTimeout(resolve, 150));

      subscriber.afterQuery(event);
    }, 'test-corr-id-123');

    const metricsStr = await metricsService.getMetrics();
    expect(metricsStr).toContain('db_slow_queries_total');
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Slow query detected'),
      expect.objectContaining({
        correlationId: 'test-corr-id-123',
        operationName: 'SELECT courses',
      }),
    );
  });
});
