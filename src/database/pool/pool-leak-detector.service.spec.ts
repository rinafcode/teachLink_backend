import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PoolLeakDetectorService } from './pool-leak-detector.service';
import { EventEmitter } from 'events';

class MockPgPool extends EventEmitter {
  totalCount = 0;
  idleCount = 0;
  waitingCount = 0;
  connect = jest.fn();
}

describe('PoolLeakDetectorService', () => {
  let service: PoolLeakDetectorService;
  let mockPgPool: MockPgPool;
  let mockDataSource: any;

  beforeEach(async () => {
    mockPgPool = new MockPgPool();

    mockDataSource = {
      isInitialized: true,
      driver: {
        master: {
          pool: mockPgPool,
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoolLeakDetectorService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    // Prevent automatically starting intervals during init in test
    jest.useFakeTimers();

    service = module.get<PoolLeakDetectorService>(PoolLeakDetectorService);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('should attach hooks to pgPool on init', () => {
    const acquireListeners = mockPgPool.listeners('acquire');
    const releaseListeners = mockPgPool.listeners('release');
    const removeListeners = mockPgPool.listeners('remove');

    expect(acquireListeners.length).toBeGreaterThan(0);
    expect(releaseListeners.length).toBeGreaterThan(0);
    expect(removeListeners.length).toBeGreaterThan(0);
  });

  it('should track connection leases and count them', () => {
    const mockClient = { id: 1 };
    expect(service.getActiveLeaseCount()).toBe(0);

    mockPgPool.emit('acquire', mockClient);
    expect(service.getActiveLeaseCount()).toBe(1);

    mockPgPool.emit('release', null, mockClient);
    expect(service.getActiveLeaseCount()).toBe(0);
  });

  it('should detect a leaked connection and emit warning', () => {
    const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();
    const mockClient = { id: 1 };

    mockPgPool.emit('acquire', mockClient);

    // Fast-forward past default leak threshold of 60s
    jest.advanceTimersByTime(65000);

    // Call private scanLeaks
    (service as any).scanLeaks();

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Potential connection leak detected'),
    );
    expect(service.getActiveLeaseCount()).toBe(0); // Cleaned up from tracking after warning
  });

  it('should remove connection from tracking if removed from pool', () => {
    const mockClient = { id: 1 };
    mockPgPool.emit('acquire', mockClient);
    expect(service.getActiveLeaseCount()).toBe(1);

    mockPgPool.emit('remove', mockClient);
    expect(service.getActiveLeaseCount()).toBe(0);
  });
});
