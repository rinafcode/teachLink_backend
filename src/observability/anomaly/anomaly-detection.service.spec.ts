import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getQueueToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { AnomalyAlert, AnomalySeverity, AnomalyStatus, AnomalyType } from '../entities/anomaly-alert.entity';
import { MetricEntry } from '../entities/metric-entry.entity';
import { LogEntry, LogLevel } from '../entities/log-entry.entity';
import { ObservabilityConfig } from '../observability.service';

// Mock the @nestjs/bull module
jest.mock('@nestjs/bull', () => ({
  getQueueToken: jest.fn((name) => `Queue_${name}`),
}));

describe('AnomalyDetectionService', () => {
  let service: AnomalyDetectionService;
  let anomalyAlertRepository: Repository<AnomalyAlert>;
  let metricEntryRepository: Repository<MetricEntry>;
  let logEntryRepository: Repository<LogEntry>;
  let anomalyQueue: Queue;

  const config: ObservabilityConfig = {
    serviceName: 'test-service',
    version: '1.0.0',
    environment: 'test',
    enableTracing: true,
    enableMetrics: true,
    enableLogging: true,
    enableAnomalyDetection: true,
    metricsExportInterval: 15000,
    logLevel: 'info',
  };

  const mockAnomalyAlertRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockMetricEntryRepository = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockLogEntryRepository = {
    count: jest.fn(),
  };

  const mockAnomalyQueue = {
    add: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const configMap = {
        NODE_ENV: 'test',
      };
      return configMap[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyDetectionService,
        {
          provide: getRepositoryToken(AnomalyAlert),
          useValue: mockAnomalyAlertRepository,
        },
        {
          provide: getRepositoryToken(MetricEntry),
          useValue: mockMetricEntryRepository,
        },
        {
          provide: getRepositoryToken(LogEntry),
          useValue: mockLogEntryRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'BullQueue_anomaly-detection',
          useValue: mockAnomalyQueue,
        },
      ],
    }).compile();

    service = module.get<AnomalyDetectionService>(AnomalyDetectionService);
    anomalyAlertRepository = module.get<Repository<AnomalyAlert>>(getRepositoryToken(AnomalyAlert));
    metricEntryRepository = module.get<Repository<MetricEntry>>(getRepositoryToken(MetricEntry));
    logEntryRepository = module.get<Repository<LogEntry>>(getRepositoryToken(LogEntry));
    anomalyQueue = module.get<Queue>('BullQueue_anomaly-detection');

    await service.initialize(config);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should detect statistical anomalies', () => {
    // Test with normal distribution
    const normalValues = [10, 11, 9, 12, 8, 10, 11, 9, 10, 11];
    expect(service.detectStatisticalAnomalies(normalValues, 2.0)).toBe(false);

    // Test with outlier
    const valuesWithOutlier = [10, 11, 9, 12, 8, 10, 11, 9, 10, 50];
    expect(service.detectStatisticalAnomalies(valuesWithOutlier, 2.0)).toBe(true);

    // Test with insufficient data
    const insufficientValues = [10, 11, 9];
    expect(service.detectStatisticalAnomalies(insufficientValues, 2.0)).toBe(false);
  });

  it('should detect trend anomalies', () => {
    // Test with stable trend
    const stableValues = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    expect(service.detectTrendAnomalies(stableValues, 5)).toBe(false);

    // Test with significant trend change
    const trendingValues = [10, 10, 10, 10, 10, 20, 20, 20, 20, 20];
    expect(service.detectTrendAnomalies(trendingValues, 5)).toBe(true);

    // Test with insufficient data
    const insufficientValues = [10, 11, 9];
    expect(service.detectTrendAnomalies(insufficientValues, 5)).toBe(false);
  });

  it('should acknowledge alert', async () => {
    const alertId = 'test-alert-id';
    const acknowledgedBy = 'test-user';
    const notes = 'Test acknowledgment';

    await service.acknowledgeAlert(alertId, acknowledgedBy, notes);

    expect(anomalyAlertRepository.update).toHaveBeenCalledWith(alertId, {
      status: AnomalyStatus.ACKNOWLEDGED,
      acknowledgedBy,
      acknowledgedAt: expect.any(Date),
      resolutionNotes: notes,
    });
  });

  it('should resolve alert', async () => {
    const alertId = 'test-alert-id';
    const resolvedBy = 'test-user';
    const notes = 'Test resolution';

    await service.resolveAlert(alertId, resolvedBy, notes);

    expect(anomalyAlertRepository.update).toHaveBeenCalledWith(alertId, {
      status: AnomalyStatus.RESOLVED,
      resolvedBy,
      resolvedAt: expect.any(Date),
      resolutionNotes: notes,
    });
  });

  it('should get active alerts', async () => {
    const mockAlerts = [
      {
        id: 'alert-1',
        status: AnomalyStatus.OPEN,
        severity: AnomalySeverity.HIGH,
        title: 'Test Alert',
      },
    ];

    mockAnomalyAlertRepository.find.mockResolvedValue(mockAlerts);

    const activeAlerts = await service.getActiveAlerts();

    expect(activeAlerts).toEqual(mockAlerts);
    expect(anomalyAlertRepository.find).toHaveBeenCalledWith({
      where: {
        status: AnomalyStatus.OPEN,
      },
      order: {
        timestamp: 'DESC',
      },
    });
  });

  it('should get anomaly statistics', async () => {
    const startTime = new Date('2023-01-01');
    const endTime = new Date('2023-01-02');

    const mockAlerts = [
      {
        severity: AnomalySeverity.HIGH,
        alertType: AnomalyType.PERFORMANCE,
        status: AnomalyStatus.OPEN,
      },
      {
        severity: AnomalySeverity.MEDIUM,
        alertType: AnomalyType.ERROR_RATE,
        status: AnomalyStatus.RESOLVED,
      },
    ];

    mockAnomalyAlertRepository.find.mockResolvedValue(mockAlerts);

    const stats = await service.getAnomalyStats(startTime, endTime);

    expect(stats).toEqual({
      total: 2,
      bySeverity: {
        [AnomalySeverity.LOW]: 0,
        [AnomalySeverity.MEDIUM]: 1,
        [AnomalySeverity.HIGH]: 1,
        [AnomalySeverity.CRITICAL]: 0,
      },
      byType: {
        [AnomalyType.PERFORMANCE]: 1,
        [AnomalyType.ERROR_RATE]: 1,
        [AnomalyType.BUSINESS_METRIC]: 0,
        [AnomalyType.SECURITY]: 0,
        [AnomalyType.RESOURCE_USAGE]: 0,
        [AnomalyType.PATTERN]: 0,
      },
      resolved: 1,
      acknowledged: 0,
      open: 1,
    });
  });

  it('should get anomaly count', async () => {
    const from = new Date('2023-01-01');
    const to = new Date('2023-01-02');

    mockAnomalyAlertRepository.count.mockResolvedValue(5);

    const count = await service.getAnomalyCount(from, to);

    expect(count).toBe(5);
    expect(anomalyAlertRepository.count).toHaveBeenCalledWith({
      where: {
        timestamp: expect.anything(),
      },
    });
  });

  it('should search anomalies', async () => {
    const query = {
      text: 'high error rate',
      correlationId: 'test-correlation-id',
      startTime: new Date('2023-01-01'),
      endTime: new Date('2023-01-02'),
      services: ['test-service'],
    };

    const mockAlerts = [
      {
        title: 'High Error Rate',
        description: 'Error rate exceeded threshold',
        correlationId: 'test-correlation-id',
        serviceName: 'test-service',
      },
    ];

    mockAnomalyAlertRepository.find.mockResolvedValue(mockAlerts);

    const results = await service.searchAnomalies(query);

    expect(results).toEqual(mockAlerts);
    expect(anomalyAlertRepository.find).toHaveBeenCalledWith({
      where: expect.objectContaining({
        correlationId: query.correlationId,
      }),
      order: { timestamp: 'DESC' },
    });
  });

  it('should get health status', async () => {
    const healthStatus = await service.getHealthStatus();

    expect(healthStatus).toEqual({ status: 'healthy' });
  });

  it('should detect seasonal anomalies (placeholder)', () => {
    // This is a placeholder test since the method returns false for now
    const values = [10, 15, 20, 15, 10, 15, 20, 15, 10, 30];
    const result = service.detectSeasonalAnomalies(values, 24);

    expect(result).toBe(false);
  });
});
