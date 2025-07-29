import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { BullModule } from '@nestjs/bull';
import { ObservabilityModule } from './observability.module';
import { ObservabilityService } from './observability.service';
import { DistributedTracingService } from './tracing/distributed-tracing.service';
import { LogAggregationService } from './logging/log-aggregation.service';
import { MetricsAnalysisService } from './metrics/metrics-analysis.service';
import { AnomalyDetectionService } from './anomaly/anomaly-detection.service';

// Mock external dependencies
jest.mock('@nestjs/elasticsearch', () => ({
  ElasticsearchModule: {
    register: jest.fn(() => ({
      module: 'MockElasticsearchModule',
      providers: [],
      exports: [],
    })),
  },
}));

jest.mock('@nestjs/bull', () => ({
  BullModule: {
    registerQueue: jest.fn(() => ({
      module: 'MockBullModule',
      providers: [],
      exports: [],
    })),
  },
}));

describe('ObservabilityModule', () => {
  let module: TestingModule;
  let observabilityService: ObservabilityService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        // Mock TypeOrmModule to avoid database connection
        {
          module: class MockTypeOrmModule {},
          providers: [
            {
              provide: 'TraceSpanRepository',
              useValue: {
                save: jest.fn(),
                find: jest.fn(),
                count: jest.fn(),
              },
            },
            {
              provide: 'LogEntryRepository',
              useValue: {
                save: jest.fn(),
                find: jest.fn(),
                count: jest.fn(),
              },
            },
            {
              provide: 'MetricEntryRepository',
              useValue: {
                save: jest.fn(),
                find: jest.fn(),
                count: jest.fn(),
              },
            },
            {
              provide: 'AnomalyAlertRepository',
              useValue: {
                save: jest.fn(),
                find: jest.fn(),
                count: jest.fn(),
                update: jest.fn(),
              },
            },
            {
              provide: 'DataSource',
              useValue: {
                createQueryRunner: jest.fn(),
              },
            },
          ],
          exports: [
            'TraceSpanRepository',
            'LogEntryRepository',
            'MetricEntryRepository',
            'AnomalyAlertRepository',
            'DataSource',
          ],
        },
        // Mock Elasticsearch
        {
          module: class MockElasticsearchModule {},
          providers: [
            {
              provide: 'ElasticsearchService',
              useValue: {
                search: jest.fn(),
                index: jest.fn(),
                indices: {
                  exists: jest.fn().mockResolvedValue(false),
                  create: jest.fn(),
                },
              },
            },
          ],
          exports: ['ElasticsearchService'],
        },
        // Mock Bull queues
        {
          module: class MockBullModule {},
          providers: [
            {
              provide: 'BullQueue_log-aggregation',
              useValue: {
                add: jest.fn(),
              },
            },
            {
              provide: 'BullQueue_metrics-analysis',
              useValue: {
                add: jest.fn(),
              },
            },
            {
              provide: 'BullQueue_anomaly-detection',
              useValue: {
                add: jest.fn(),
              },
            },
          ],
          exports: [
            'BullQueue_log-aggregation',
            'BullQueue_metrics-analysis',
            'BullQueue_anomaly-detection',
          ],
        },
      ],
      providers: [
        ObservabilityService,
        DistributedTracingService,
        LogAggregationService,
        MetricsAnalysisService,
        AnomalyDetectionService,
        {
          provide: 'Repository<TraceSpan>',
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: 'Repository<LogEntry>',
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: 'Repository<MetricEntry>',
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: 'Repository<AnomalyAlert>',
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    observabilityService = module.get<ObservabilityService>(ObservabilityService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide ObservabilityService', () => {
    expect(observabilityService).toBeDefined();
    expect(observabilityService).toBeInstanceOf(ObservabilityService);
  });

  it('should provide all required services', () => {
    const tracingService = module.get<DistributedTracingService>(DistributedTracingService);
    const loggingService = module.get<LogAggregationService>(LogAggregationService);
    const metricsService = module.get<MetricsAnalysisService>(MetricsAnalysisService);
    const anomalyService = module.get<AnomalyDetectionService>(AnomalyDetectionService);

    expect(tracingService).toBeDefined();
    expect(loggingService).toBeDefined();
    expect(metricsService).toBeDefined();
    expect(anomalyService).toBeDefined();
  });

  it('should initialize observability service', async () => {
    // Mock the initialization methods
    const tracingService = module.get<DistributedTracingService>(DistributedTracingService);
    const loggingService = module.get<LogAggregationService>(LogAggregationService);
    const metricsService = module.get<MetricsAnalysisService>(MetricsAnalysisService);
    const anomalyService = module.get<AnomalyDetectionService>(AnomalyDetectionService);

    jest.spyOn(tracingService, 'initialize').mockResolvedValue();
    jest.spyOn(loggingService, 'initialize').mockResolvedValue();
    jest.spyOn(metricsService, 'initialize').mockResolvedValue();
    jest.spyOn(anomalyService, 'initialize').mockResolvedValue();

    await observabilityService.onModuleInit();

    expect(tracingService.initialize).toHaveBeenCalled();
    expect(loggingService.initialize).toHaveBeenCalled();
    expect(metricsService.initialize).toHaveBeenCalled();
    expect(anomalyService.initialize).toHaveBeenCalled();
  });

  it('should get observability configuration', () => {
    const config = observabilityService.getConfig();

    expect(config).toBeDefined();
    expect(config.serviceName).toBeDefined();
    expect(config.version).toBeDefined();
    expect(config.environment).toBeDefined();
  });

  it('should generate correlation ID', () => {
    const correlationId = observabilityService.generateCorrelationId();

    expect(correlationId).toBeDefined();
    expect(typeof correlationId).toBe('string');
    expect(correlationId.length).toBeGreaterThan(0);
  });

  it('should get health status', async () => {
    // Mock health status for all services
    const tracingService = module.get<DistributedTracingService>(DistributedTracingService);
    const loggingService = module.get<LogAggregationService>(LogAggregationService);
    const metricsService = module.get<MetricsAnalysisService>(MetricsAnalysisService);
    const anomalyService = module.get<AnomalyDetectionService>(AnomalyDetectionService);

    jest.spyOn(tracingService, 'getHealthStatus').mockResolvedValue({ status: 'healthy' });
    jest.spyOn(loggingService, 'getHealthStatus').mockResolvedValue({ status: 'healthy' });
    jest.spyOn(metricsService, 'getHealthStatus').mockResolvedValue({ status: 'healthy' });
    jest.spyOn(anomalyService, 'getHealthStatus').mockResolvedValue({ status: 'healthy' });

    const healthStatus = await observabilityService.getHealthStatus();

    expect(healthStatus).toBeDefined();
    expect(healthStatus.status).toBe('healthy');
    expect(healthStatus.components).toBeDefined();
    expect(healthStatus.timestamp).toBeInstanceOf(Date);
  });

  it('should get observability statistics', async () => {
    // Mock statistics for all services
    const tracingService = module.get<DistributedTracingService>(DistributedTracingService);
    const loggingService = module.get<LogAggregationService>(LogAggregationService);
    const metricsService = module.get<MetricsAnalysisService>(MetricsAnalysisService);
    const anomalyService = module.get<AnomalyDetectionService>(AnomalyDetectionService);

    jest.spyOn(tracingService, 'getTraceCount').mockResolvedValue(10);
    jest.spyOn(loggingService, 'getLogCount').mockResolvedValue(100);
    jest.spyOn(metricsService, 'getMetricCount').mockResolvedValue(50);
    jest.spyOn(anomalyService, 'getAnomalyCount').mockResolvedValue(5);

    const stats = await observabilityService.getObservabilityStats();

    expect(stats).toBeDefined();
    expect(stats.traces).toBe(10);
    expect(stats.logs).toBe(100);
    expect(stats.metrics).toBe(50);
    expect(stats.anomalies).toBe(5);
    expect(stats.period).toBe('24h');
  });
});
