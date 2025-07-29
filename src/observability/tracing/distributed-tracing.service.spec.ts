import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { DistributedTracingService } from './distributed-tracing.service';
import { TraceSpan } from '../entities/trace-span.entity';

describe('DistributedTracingService', () => {
  let service: DistributedTracingService;
  let traceSpanRepository: Repository<TraceSpan>;
  let configService: ConfigService;
  let elasticsearchService: ElasticsearchService;

  const mockTraceSpanRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        OBSERVABILITY_SERVICE_NAME: 'test-service',
        OBSERVABILITY_VERSION: '1.0.0',
        NODE_ENV: 'test',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317',
      };
      return config[key] || defaultValue;
    }),
  };

  const mockElasticsearchService = {
    search: jest.fn().mockResolvedValue({
      hits: {
        hits: [],
      },
    }),
    index: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributedTracingService,
        {
          provide: getRepositoryToken(TraceSpan),
          useValue: mockTraceSpanRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<DistributedTracingService>(DistributedTracingService);
    traceSpanRepository = module.get<Repository<TraceSpan>>(getRepositoryToken(TraceSpan));
    configService = module.get<ConfigService>(ConfigService);
    elasticsearchService = module.get<ElasticsearchService>(ElasticsearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize distributed tracing', async () => {
    const config = {
      serviceName: 'test-service',
      version: '1.0.0',
      environment: 'test',
    };

    await service.initialize(config);

    // Verify that initialization completes without errors
    expect(service).toBeDefined();
  });

  it('should generate correlation ID', () => {
    const correlationId = service.generateCorrelationId();
    
    expect(correlationId).toBeDefined();
    expect(typeof correlationId).toBe('string');
    expect(correlationId.length).toBeGreaterThan(0);
  });

  it('should start a span', async () => {
    const spanOptions = {
      operationName: 'test-operation',
      tags: { userId: '123' },
    };

    const span = await service.startSpan(spanOptions);

    // Note: The actual span might be undefined in test environment due to tracer initialization
    // In a real scenario, we would mock the OpenTelemetry tracer
    expect(span).toBeDefined();
  });

  it('should get health status', async () => {
    const healthStatus = await service.getHealthStatus();

    expect(healthStatus).toEqual({ status: 'healthy' });
  });

  it('should get trace count', async () => {
    const from = new Date('2023-01-01');
    const to = new Date('2023-01-02');
    
    mockTraceSpanRepository.count.mockResolvedValue(5);

    const count = await service.getTraceCount(from, to);

    expect(count).toBe(5);
    expect(mockTraceSpanRepository.count).toHaveBeenCalledWith({
      where: { timestamp: expect.anything() },
    });
  });

  it('should search traces', async () => {
    const query = {
      text: 'error',
      correlationId: 'test-correlation-id',
      startTime: new Date('2023-01-01'),
      endTime: new Date('2023-01-02'),
    };

    const mockResults = [
      { _source: { traceId: '123', operationName: 'test' } },
    ];

    mockElasticsearchService.search.mockResolvedValue({
      hits: {
        hits: mockResults,
      },
    });

    const results = await service.searchTraces(query);

    expect(results).toEqual(mockResults);
    expect(mockElasticsearchService.search).toHaveBeenCalledWith({
      index: 'trace_spans',
      body: expect.objectContaining({
        query: expect.objectContaining({
          bool: expect.objectContaining({
            must: expect.any(Array),
          }),
        }),
      }),
    });
  });
});
