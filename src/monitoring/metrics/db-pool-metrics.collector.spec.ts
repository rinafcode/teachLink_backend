import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DbPoolMetricsCollector } from './db-pool-metrics.collector';
import { MetricsCollectionService } from './metrics-collection.service';
import { EventEmitter } from 'events';

class MockPgPool extends EventEmitter {
  totalCount = 10;
  idleCount = 4;
  waitingCount = 2;
  connect = jest.fn().mockResolvedValue({ id: 'client-1' });
}

describe('DbPoolMetricsCollector', () => {
  let collector: DbPoolMetricsCollector;
  let mockPgPool: MockPgPool;
  let mockDataSource: any;
  let metricsService: MetricsCollectionService;

  beforeEach(async () => {
    mockPgPool = new MockPgPool();
    mockDataSource = {
      isInitialized: true,
      driver: {
        pool: mockPgPool,
      },
    };

    metricsService = new MetricsCollectionService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbPoolMetricsCollector,
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

    collector = module.get<DbPoolMetricsCollector>(DbPoolMetricsCollector);
    collector.onModuleInit();
  });

  it('should initialize and register event listeners', () => {
    expect(mockPgPool.listeners('connect').length).toBeGreaterThan(0);
    expect(mockPgPool.listeners('acquire').length).toBeGreaterThan(0);
    expect(mockPgPool.listeners('release').length).toBeGreaterThan(0);
    expect(mockPgPool.listeners('remove').length).toBeGreaterThan(0);
  });

  it('should collect pool metrics and update gauges', async () => {
    collector.collectPoolMetrics();

    // Check gauges
    const metricsStr = await metricsService.getMetrics();

    expect(metricsStr).toContain('db_pool_size 10');
    expect(metricsStr).toContain('db_active_connections 6'); // totalCount(10) - idleCount(4)
    expect(metricsStr).toContain('db_pool_idle_connections 4');
    expect(metricsStr).toContain('db_pool_pending_requests 2');
  });

  it('should wrap pgPool.connect and track wait metrics', async () => {
    // Trigger connect with no idle connections to trigger wait count
    mockPgPool.idleCount = 0;
    mockPgPool.waitingCount = 1;

    const client = await (mockPgPool as any).connect();
    expect(client).toEqual({ id: 'client-1' });

    const metricsStr = await metricsService.getMetrics();
    expect(metricsStr).toContain('db_pool_waits_total 1');
    expect(metricsStr).toContain('db_pool_wait_duration_seconds_bucket');
  });

  it('should track max lifetime closed and max idle closed upon connection removal', async () => {
    const mockClient: any = { id: 'client-2' };
    mockPgPool.emit('connect', mockClient);

    // Age the connection to exceed max lifetime (default 1800s / 30m)
    // 1800s = 1,800,000ms.
    mockClient.createdAt = Date.now() - 1850000;

    mockPgPool.emit('remove', mockClient);

    const metricsStr = await metricsService.getMetrics();
    expect(metricsStr).toContain('db_pool_max_lifetime_closed_total 1');
    expect(metricsStr).not.toContain('db_pool_max_idle_closed_total 1');
  });

  it('should track max idle closed if closed connection spent long time idle', async () => {
    const mockClient: any = { id: 'client-3' };
    mockPgPool.emit('connect', mockClient);

    // Keep age low but idle duration high (default idleTimeoutMs is 30s)
    mockClient.createdAt = Date.now() - 5000;
    mockClient.lastReleasedAt = Date.now() - 35000;

    mockPgPool.emit('remove', mockClient);

    const metricsStr = await metricsService.getMetrics();
    expect(metricsStr).toContain('db_pool_max_idle_closed_total 1');
    expect(metricsStr).not.toContain('db_pool_max_lifetime_closed_total 1');
  });
});
