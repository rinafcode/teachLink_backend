import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { LogAggregationService } from './log-aggregation.service';
import { LogEntry } from '../entities/log-entry.entity';
import { ObservabilityConfig } from '../observability.service';

describe('LogAggregationService', () => {
  let service: LogAggregationService;
  let logEntryRepository: Repository<LogEntry>;
  let elasticsearchService: ElasticsearchService;

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

  const mockLogEntryRepository = {
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockElasticsearchService = {
    index: jest.fn(),
    search: jest.fn().mockResolvedValue({
      hits: {
        hits: [],
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogAggregationService,
        {
          provide: getRepositoryToken(LogEntry),
          useValue: mockLogEntryRepository,
        },
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
      ],
    }).compile();

    service = module.get<LogAggregationService>(LogAggregationService);
    logEntryRepository = module.get<Repository<LogEntry>>(getRepositoryToken(LogEntry));
    elasticsearchService = module.get<ElasticsearchService>(ElasticsearchService);

    await service.initialize(config);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log a message', async () => {
    const message = 'Test log message';
    const level = 'info';
    const context = { key: 'value' };

    await service.log(level, message, context);

    expect(logEntryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      message,
      level,
      context,
    }));
    expect(elasticsearchService.index).toHaveBeenCalledWith(expect.anything());
  });

  it('should get log count', async () => {
    mockLogEntryRepository.count.mockResolvedValue(5);

    const from = new Date('2023-01-01');
    const to = new Date('2023-01-02');
    const count = await service.getLogCount(from, to);

    expect(count).toBe(5);
    expect(logEntryRepository.count).toHaveBeenCalledWith({
      where: { timestamp: expect.anything() },
    });
  });

  it('should search logs', async () => {
    const query = {
      text: 'error',
      correlationId: 'test-id',
      startTime: new Date('2023-01-01'),
      endTime: new Date('2023-01-02'),
    };

    const mockResults = [{ _source: { message: 'error occurred' } }];

    mockElasticsearchService.search.mockResolvedValue({
      hits: {
        hits: mockResults,
      },
    });

    const results = await service.searchLogs(query);

    expect(results).toEqual(mockResults);
    expect(elasticsearchService.search).toHaveBeenCalledWith(expect.anything());
  });
});

