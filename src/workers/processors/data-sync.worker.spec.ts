import { DataSyncWorker } from './data-sync.worker';

describe('DataSyncWorker', () => {
  let worker: DataSyncWorker;

  beforeEach(() => {
    worker = new DataSyncWorker();
  });

  it('should perform consistency check', async () => {
    const mockJob = {
      id: '1',
      name: 'consistency-check',
      data: { syncType: 'consistency-check', source: 'postgres' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.syncType).toBe('consistency-check');
    expect(result.data.recordsChecked).toBeGreaterThan(0);
  });

  it('should replicate data', async () => {
    const mockJob = {
      id: '1',
      name: 'replicate-data',
      data: {
        syncType: 'replicate-data',
        source: 'primary-db',
        destination: 'replica-db',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.recordsReplicated).toBeGreaterThan(0);
  });

  it('should reconcile data', async () => {
    const mockJob = {
      id: '1',
      name: 'reconcile',
      data: { syncType: 'reconcile', source: 'db1', destination: 'db2' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.syncType).toBe('reconcile');
  });

  it('should fail if syncType is missing', async () => {
    const mockJob = {
      id: '1',
      name: 'sync',
      data: { source: 'database' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    await expect(worker.handle(mockJob)).rejects.toThrow(
      'Missing required sync fields: syncType, source',
    );
  });

  it('should fail for unsupported sync type', async () => {
    const mockJob = {
      id: '1',
      name: 'sync',
      data: { syncType: 'unknown-type', source: 'database' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    await expect(worker.handle(mockJob)).rejects.toThrow(
      'Unsupported sync type: unknown-type',
    );
  });
});
