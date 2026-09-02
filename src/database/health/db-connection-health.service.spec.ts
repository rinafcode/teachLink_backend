import { DbConnectionHealthService } from './db-connection-health.service';
import { DataSource } from 'typeorm';

describe('DbConnectionHealthService', () => {
  const makeDataSource = () =>
    ({
      query: jest.fn(),
      destroy: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue(undefined),
      driver: { master: { pool: { totalCount: 2, idleCount: 1, waitingCount: 0 } } },
    }) as unknown as DataSource;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('runs a scheduled check on module init and registers the interval', async () => {
    const service = new DbConnectionHealthService(makeDataSource());
    const runCheck = jest.spyOn(service as any, 'runCheck').mockResolvedValue(undefined);
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue(123 as any);

    service.onModuleInit();

    expect(setIntervalSpy).toHaveBeenCalled();
    expect(runCheck).toHaveBeenCalled();
  });

  it('clears the interval on module destroy', () => {
    const service = new DbConnectionHealthService(makeDataSource());
    (service as any).intervalRef = 456;
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    service.onModuleDestroy();

    expect(clearIntervalSpy).toHaveBeenCalledWith(456);
  });

  it('returns a healthy result and caches it when the probe succeeds', async () => {
    const dataSource = makeDataSource();
    dataSource.query = jest.fn().mockResolvedValueOnce([]);
    const service = new DbConnectionHealthService(dataSource);

    const result = await service.check();

    expect(result.status).toBe('healthy');
    expect(service.getLastResult()).toEqual(result);
  });

  it('returns an unhealthy result when the probe fails', async () => {
    const dataSource = makeDataSource();
    dataSource.query = jest.fn().mockRejectedValueOnce(new Error('db down'));
    const service = new DbConnectionHealthService(dataSource);

    const result = await service.check();

    expect(result.status).toBe('unhealthy');
    expect(result.message).toContain('db down');
    expect(service.getLastResult()).toEqual(result);
  });
});
