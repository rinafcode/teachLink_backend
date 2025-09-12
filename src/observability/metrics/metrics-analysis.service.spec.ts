import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { MetricsAnalysisService } from './metrics-analysis.service';
import { MetricEntry, MetricType } from '../entities/metric-entry.entity';
import { ObservabilityConfig } from '../observability.service';

describe('MetricsAnalysisService', () => {
  let service: MetricsAnalysisService;
  let metricEntryRepository: Repository<MetricEntry>;
  let elasticsearchService: ElasticsearchService;
  let configService: ConfigService;

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

  const mockMetricEntryRepository = {
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockElasticsearchService = {
    index: jest.fn(),
    search: jest.fn().mockResolvedValue({
      hits: {
        hits: [],
      },
    }),
    indices: {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn(),
    },
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
        MetricsAnalysisService,
        {
          provide: getRepositoryToken(MetricEntry),
          useValue: mockMetricEntryRepository,
        },
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MetricsAnalysisService>(MetricsAnalysisService);
    metricEntryRepository = module.get<Repository<MetricEntry>>(
      getRepositoryToken(MetricEntry),
    );
    elasticsearchService =
      module.get<ElasticsearchService>(ElasticsearchService);
    configService = module.get<ConfigService>(ConfigService);

    await service.initialize(config);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should record a metric', async () => {
    const metricName = 'test_metric';
    const value = 42;
    const type = MetricType.COUNTER;
    const tags = { environment: 'test' };

    await service.recordMetric(metricName, value, type, tags);

    expect(metricEntryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        metricName,
        value,
        metricType: type,
        tags,
      }),
    );

    expect(elasticsearchService.index).toHaveBeenCalledWith({
      index: 'metric_entries',
      body: expect.any(Object),
    });
  });

  it('should record user registration', async () => {
    const recordMetricSpy = jest
      .spyOn(service, 'recordMetric')
      .mockResolvedValue();

    await service.recordUserRegistration('email', 'success');

    expect(recordMetricSpy).toHaveBeenCalledWith(
      'user_registrations',
      1,
      MetricType.COUNTER,
      { method: 'email', status: 'success' },
    );
  });

  it('should record course enrollment', async () => {
    const recordMetricSpy = jest
      .spyOn(service, 'recordMetric')
      .mockResolvedValue();

    await service.recordCourseEnrollment('course-123', 'student');

    expect(recordMetricSpy).toHaveBeenCalledWith(
      'course_enrollments',
      1,
      MetricType.COUNTER,
      { courseId: 'course-123', userType: 'student' },
    );
  });

  it('should record assessment completion', async () => {
    const recordMetricSpy = jest
      .spyOn(service, 'recordMetric')
      .mockResolvedValue();

    await service.recordAssessmentCompletion('assessment-123', 85);

    expect(recordMetricSpy).toHaveBeenCalledWith(
      'assessment_completions',
      1,
      MetricType.COUNTER,
      { assessmentId: 'assessment-123', score: 85, scoreRange: '80-89' },
    );
  });

  it('should record payment transaction', async () => {
    const recordMetricSpy = jest
      .spyOn(service, 'recordMetric')
      .mockResolvedValue();

    await service.recordPaymentTransaction('stripe', 'success', 99.99);

    expect(recordMetricSpy).toHaveBeenCalledWith(
      'payment_transactions',
      99.99,
      MetricType.COUNTER,
      { method: 'stripe', status: 'success', amountRange: '50-99' },
    );
  });

  it('should update active users', async () => {
    const recordMetricSpy = jest
      .spyOn(service, 'recordMetric')
      .mockResolvedValue();

    await service.updateActiveUsers(150);

    expect(recordMetricSpy).toHaveBeenCalledWith(
      'active_users',
      150,
      MetricType.GAUGE,
      { timePeriod: 'current' },
    );
  });

  it('should record request duration', async () => {
    const recordMetricSpy = jest
      .spyOn(service, 'recordMetric')
      .mockResolvedValue();

    await service.recordRequestDuration('GET', '/api/users', 200, 1500);

    expect(recordMetricSpy).toHaveBeenCalledWith(
      'request_duration',
      1500,
      MetricType.HISTOGRAM,
      { method: 'GET', route: '/api/users', statusCode: 200 },
    );
  });

  it('should record error', async () => {
    const recordMetricSpy = jest
      .spyOn(service, 'recordMetric')
      .mockResolvedValue();

    await service.recordError('validation_error', 'auth-service', 'medium');

    expect(recordMetricSpy).toHaveBeenCalledWith(
      'errors',
      1,
      MetricType.COUNTER,
      {
        errorType: 'validation_error',
        service: 'auth-service',
        severity: 'medium',
      },
    );
  });

  it('should get metric analytics', async () => {
    const mockMetrics = [
      { value: 10, timestamp: new Date('2023-01-01T00:00:00Z') },
      { value: 20, timestamp: new Date('2023-01-01T01:00:00Z') },
      { value: 30, timestamp: new Date('2023-01-01T02:00:00Z') },
    ];

    mockMetricEntryRepository.find.mockResolvedValue(mockMetrics);

    const analytics = await service.getMetricAnalytics(
      'test_metric',
      new Date('2023-01-01T00:00:00Z'),
      new Date('2023-01-01T03:00:00Z'),
    );

    expect(analytics).toEqual({
      total: 60,
      average: 20,
      min: 10,
      max: 30,
      count: 3,
      percentiles: expect.objectContaining({
        p50: expect.any(Number),
        p90: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number),
      }),
    });
  });

  it('should get metric count', async () => {
    mockMetricEntryRepository.count.mockResolvedValue(10);

    const count = await service.getMetricCount(
      new Date('2023-01-01'),
      new Date('2023-01-02'),
    );

    expect(count).toBe(10);
    expect(metricEntryRepository.count).toHaveBeenCalledWith({
      where: {
        timestamp: expect.anything(),
      },
    });
  });

  it('should search metrics', async () => {
    const query = {
      text: 'user_registrations',
      correlationId: 'test-correlation-id',
      startTime: new Date('2023-01-01'),
      endTime: new Date('2023-01-02'),
    };

    const mockResults = [
      { _source: { metricName: 'user_registrations', value: 5 } },
    ];

    mockElasticsearchService.search.mockResolvedValue({
      hits: {
        hits: mockResults,
      },
    });

    const results = await service.searchMetrics(query);

    expect(results).toEqual(mockResults);
    expect(elasticsearchService.search).toHaveBeenCalledWith({
      index: 'metric_entries',
      body: expect.objectContaining({
        query: expect.objectContaining({
          bool: expect.objectContaining({
            must: expect.any(Array),
          }),
        }),
      }),
    });
  });

  it('should get health status', async () => {
    const healthStatus = await service.getHealthStatus();

    expect(healthStatus).toEqual({ status: 'healthy' });
  });
});
