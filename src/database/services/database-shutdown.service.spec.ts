import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { DatabaseShutdownService } from './database-shutdown.service';
import { PoolMonitorService } from '../pool/pool-monitor.service';

const SHUTDOWN_ENV_KEYS = [
  'DB_DRAIN_TIMEOUT_MS',
  'DB_FORCE_CLOSE_TIMEOUT_MS',
  'DB_WAIT_FOR_QUERIES',
  'DB_LOG_SHUTDOWN_DETAILS',
] as const;

type ShutdownEnv = Partial<Record<(typeof SHUTDOWN_ENV_KEYS)[number], string>>;

describe('DatabaseShutdownService', () => {
  let service: DatabaseShutdownService;
  let mockDataSource: {
    isInitialized: boolean;
    destroy: jest.Mock;
    query: jest.Mock;
    driver: any;
  };
  let mockPoolMonitor: { snapshot: Record<string, number> };
  let originalEnv: ShutdownEnv;

  /** Options are read from env at construction, so env must be set before compiling. */
  const createService = async (env: ShutdownEnv = {}): Promise<DatabaseShutdownService> => {
    for (const key of SHUTDOWN_ENV_KEYS) {
      if (env[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = env[key];
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseShutdownService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: PoolMonitorService, useValue: mockPoolMonitor },
      ],
    }).compile();

    service = module.get(DatabaseShutdownService);
    return service;
  };

  const drainedPool = (overrides: Record<string, unknown> = {}) => ({
    totalCount: 2,
    idleCount: 2,
    waitingCount: 0,
    end: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const useFakeTimers = () => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

  beforeAll(() => {
    originalEnv = Object.fromEntries(SHUTDOWN_ENV_KEYS.map((key) => [key, process.env[key]]));
  });

  afterAll(() => {
    for (const key of SHUTDOWN_ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  beforeEach(() => {
    mockDataSource = {
      isInitialized: true,
      destroy: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ active_count: '0' }]),
      driver: {},
    };
    mockPoolMonitor = {
      snapshot: { total: 5, idle: 3, waiting: 0, utilizationPct: 40 },
    };

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('getShutdownStatus', () => {
    it('returns default options, not shutting down, and the current pool snapshot', async () => {
      await createService();

      expect(service.getShutdownStatus()).toEqual({
        isShuttingDown: false,
        options: {
          drainTimeoutMs: 15000,
          forceCloseTimeoutMs: 5000,
          waitForActiveQueries: true,
          logConnectionDetails: false,
        },
        poolSnapshot: mockPoolMonitor.snapshot,
      });
    });

    it('reads option overrides from environment variables', async () => {
      await createService({
        DB_DRAIN_TIMEOUT_MS: '1234',
        DB_FORCE_CLOSE_TIMEOUT_MS: '567',
        DB_WAIT_FOR_QUERIES: 'false',
        DB_LOG_SHUTDOWN_DETAILS: 'true',
      });

      expect(service.getShutdownStatus().options).toEqual({
        drainTimeoutMs: 1234,
        forceCloseTimeoutMs: 567,
        waitForActiveQueries: false,
        logConnectionDetails: true,
      });
    });

    it('reports isShuttingDown after shutdown has started', async () => {
      await createService();
      useFakeTimers();

      await service.shutdown();

      expect(service.getShutdownStatus().isShuttingDown).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('drains, waits for queries, and destroys the data source (happy path)', async () => {
      mockDataSource.driver = { pool: drainedPool() };
      await createService();
      useFakeTimers();

      await expect(service.shutdown()).resolves.toBeUndefined();

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      expect(mockDataSource.query.mock.calls[0][0]).toContain('pg_stat_activity');
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
      expect(mockDataSource.driver.pool.end).not.toHaveBeenCalled();
    });

    it('skips the drain phase when no connection pool is available', async () => {
      mockDataSource.driver = undefined;
      await createService();
      useFakeTimers();

      await service.shutdown();

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'No connection pool found, skipping drain phase',
      );
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('uses the master pool for replicated drivers and waits until it is drained', async () => {
      const pool = drainedPool({ idleCount: 1, waitingCount: 1 });
      mockDataSource.driver = { master: { pool } };
      await createService();
      useFakeTimers();

      let settled = false;
      const promise = service.shutdown().then(() => (settled = true));

      await jest.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      expect(mockDataSource.destroy).not.toHaveBeenCalled();

      pool.idleCount = 2;
      pool.waitingCount = 0;
      await jest.advanceTimersByTimeAsync(200);
      await promise;

      expect(settled).toBe(true);
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('polls until active queries finish before closing connections', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ active_count: '3' }])
        .mockResolvedValueOnce([{ active_count: '1' }])
        .mockResolvedValue([{ active_count: '0' }]);
      await createService();
      useFakeTimers();

      const promise = service.shutdown();

      await jest.advanceTimersByTimeAsync(500);
      expect(mockDataSource.destroy).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(500);
      await promise;

      expect(mockDataSource.query).toHaveBeenCalledTimes(3);
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('does not query active connections when DB_WAIT_FOR_QUERIES is false', async () => {
      await createService({ DB_WAIT_FOR_QUERIES: 'false' });
      useFakeTimers();

      await service.shutdown();

      expect(mockDataSource.query).not.toHaveBeenCalled();
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('treats an empty query result as zero active queries', async () => {
      mockDataSource.query.mockResolvedValue([]);
      await createService();
      useFakeTimers();

      await expect(service.shutdown()).resolves.toBeUndefined();
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('continues shutdown when the active query check fails', async () => {
      mockDataSource.query.mockRejectedValue(new Error('connection lost'));
      await createService();
      useFakeTimers();

      await expect(service.shutdown()).resolves.toBeUndefined();
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('continues shutdown when reading pool stats throws during drain', async () => {
      const pool = {
        get totalCount(): number {
          throw new Error('pool unavailable');
        },
      };
      mockDataSource.driver = { pool };
      await createService();
      useFakeTimers();

      await expect(service.shutdown()).resolves.toBeUndefined();
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('does not destroy the data source when it is not initialized', async () => {
      mockDataSource.isInitialized = false;
      await createService();
      useFakeTimers();

      await expect(service.shutdown()).resolves.toBeUndefined();
      expect(mockDataSource.destroy).not.toHaveBeenCalled();
    });

    it('ignores repeated calls while a shutdown is already in progress', async () => {
      await createService();
      useFakeTimers();

      await Promise.all([service.shutdown(), service.shutdown()]);
      await service.shutdown();

      expect(Logger.prototype.warn).toHaveBeenCalledWith('Database shutdown already in progress');
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('rejects when connections do not drain before the timeout', async () => {
      mockDataSource.driver = { pool: drainedPool({ idleCount: 0 }) };
      await createService({ DB_DRAIN_TIMEOUT_MS: '1000' });
      useFakeTimers();

      const assertion = expect(service.shutdown()).rejects.toThrow('Connection drain timeout');
      await jest.advanceTimersByTimeAsync(1000);
      await assertion;

      expect(mockDataSource.destroy).not.toHaveBeenCalled();
    });

    it('rejects when active queries do not finish before the timeout', async () => {
      mockDataSource.query.mockResolvedValue([{ active_count: '2' }]);
      await createService({ DB_DRAIN_TIMEOUT_MS: '1000' });
      useFakeTimers();

      const assertion = expect(service.shutdown()).rejects.toThrow(
        'Timeout waiting for active database queries',
      );
      await jest.advanceTimersByTimeAsync(1000);
      await assertion;

      expect(mockDataSource.destroy).not.toHaveBeenCalled();
    });

    it('force closes the pool when destroying the data source fails', async () => {
      const pool = drainedPool();
      mockDataSource.driver = { pool };
      mockDataSource.destroy.mockRejectedValue(new Error('destroy failed'));
      await createService();
      useFakeTimers();

      await expect(service.shutdown()).resolves.toBeUndefined();

      expect(pool.end).toHaveBeenCalledTimes(1);
      expect(Logger.prototype.warn).toHaveBeenCalledWith('Force closing database connections...');
    });

    it('force closes the pool when destroying the data source exceeds the timeout', async () => {
      const pool = drainedPool();
      mockDataSource.driver = { pool };
      mockDataSource.destroy.mockReturnValue(new Promise(() => undefined));
      await createService({ DB_FORCE_CLOSE_TIMEOUT_MS: '300' });
      useFakeTimers();

      const promise = service.shutdown();
      await jest.advanceTimersByTimeAsync(0);
      expect(pool.end).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(300);
      await expect(promise).resolves.toBeUndefined();

      expect(pool.end).toHaveBeenCalledTimes(1);
    });

    it('resolves when destroy fails and there is no pool to force close', async () => {
      mockDataSource.destroy.mockRejectedValue(new Error('destroy failed'));
      await createService();
      useFakeTimers();

      await expect(service.shutdown()).resolves.toBeUndefined();
      expect(Logger.prototype.log).toHaveBeenCalledWith('Force close completed');
    });

    it('rejects when both graceful destroy and force close fail', async () => {
      const forceError = new Error('pool end failed');
      mockDataSource.driver = {
        pool: drainedPool({ end: jest.fn().mockRejectedValue(forceError) }),
      };
      mockDataSource.destroy.mockRejectedValue(new Error('destroy failed'));
      await createService();
      useFakeTimers();

      await expect(service.shutdown()).rejects.toBe(forceError);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Error during database shutdown:',
        forceError,
      );
    });

    it('logs pool status before shutdown when DB_LOG_SHUTDOWN_DETAILS is true', async () => {
      await createService({ DB_LOG_SHUTDOWN_DETAILS: 'true', DB_WAIT_FOR_QUERIES: 'false' });
      useFakeTimers();

      await service.shutdown();

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Pool status before shutdown: total=5, idle=3, waiting=0, utilization=40%, active_queries=0',
      );
    });

    it('still shuts down when logging pool status fails', async () => {
      Object.defineProperty(mockPoolMonitor, 'snapshot', {
        get: () => {
          throw new Error('monitor unavailable');
        },
      });
      await createService({ DB_LOG_SHUTDOWN_DETAILS: 'true', DB_WAIT_FOR_QUERIES: 'false' });
      useFakeTimers();

      await expect(service.shutdown()).resolves.toBeUndefined();
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('triggers shutdown when not already shutting down', async () => {
      await createService();
      useFakeTimers();
      const shutdownSpy = jest.spyOn(service, 'shutdown');

      await service.onModuleDestroy();

      expect(shutdownSpy).toHaveBeenCalledTimes(1);
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('does not trigger shutdown again after shutdown has already run', async () => {
      await createService();
      useFakeTimers();
      await service.shutdown();
      const shutdownSpy = jest.spyOn(service, 'shutdown');

      await service.onModuleDestroy();

      expect(shutdownSpy).not.toHaveBeenCalled();
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
