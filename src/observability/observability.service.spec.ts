import { Test, TestingModule } from '@nestjs/testing';
import { ObservabilityService } from './observability.service';
import { MetricsAnalysisService } from './metrics/metrics-analysis.service';
import { LogAggregationService } from './logging/log-aggregation.service';
import { DistributedTracingService } from './tracing/distributed-tracing.service';
import { AnomalyDetectionService } from './anomaly/anomaly-detection.service';
import { ConfigService } from '@nestjs/config';

describe('ObservabilityService', () => {
  let service: ObservabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObservabilityService,
        {
          provide: ConfigService,
          useValue: {},
        },
        {
          provide: MetricsAnalysisService,
          useValue: {
            initialize: jest.fn(),
          },
        },
        {
          provide: LogAggregationService,
          useValue: {
            initialize: jest.fn(),
          },
        },
        {
          provide: DistributedTracingService,
          useValue: {
            initialize: jest.fn(),
          },
        },
        {
          provide: AnomalyDetectionService,
          useValue: {
            initialize: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ObservabilityService>(ObservabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize services', async () => {
    const metricsService = module.get<MetricsAnalysisService>(
      MetricsAnalysisService,
    );
    const loggingService = module.get<LogAggregationService>(
      LogAggregationService,
    );
    const tracingService = module.get<DistributedTracingService>(
      DistributedTracingService,
    );
    const anomalyService = module.get<AnomalyDetectionService>(
      AnomalyDetectionService,
    );

    await service.onModuleInit();

    expect(metricsService.initialize).toHaveBeenCalled();
    expect(loggingService.initialize).toHaveBeenCalled();
    expect(tracingService.initialize).toHaveBeenCalled();
    expect(anomalyService.initialize).toHaveBeenCalled();
  });
});
