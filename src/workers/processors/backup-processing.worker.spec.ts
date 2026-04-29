import { BackupProcessingWorker } from './backup-processing.worker';

describe('BackupProcessingWorker', () => {
  let worker: BackupProcessingWorker;

  beforeEach(() => {
    worker = new BackupProcessingWorker();
  });

  it('should perform full backup', async () => {
    const mockJob = {
      id: '1',
      name: 'backup-data',
      data: { backupType: 'full', targetDatabase: 'main_db' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.backupType).toBe('full');
    expect(result.data.size).toBeGreaterThan(0);
  });

  it('should perform incremental backup', async () => {
    const mockJob = {
      id: '1',
      name: 'backup-incremental',
      data: { backupType: 'incremental', targetDatabase: 'main_db' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.backupType).toBe('incremental');
  });

  it('should perform differential backup', async () => {
    const mockJob = {
      id: '1',
      name: 'backup-differential',
      data: { backupType: 'differential', targetDatabase: 'main_db' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.backupType).toBe('differential');
  });

  it('should restore from backup', async () => {
    const mockJob = {
      id: '1',
      name: 'restore-backup',
      data: { backupType: 'restore', targetDatabase: 'main_db', destination: 'backup-path' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.backupType).toBe('restore');
    expect(result.data.recordsRestored).toBeGreaterThan(0);
  });

  it('should fail if backupType is missing', async () => {
    const mockJob = {
      id: '1',
      name: 'backup',
      data: { targetDatabase: 'main_db' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    await expect(worker.handle(mockJob)).rejects.toThrow(
      'Missing required backup fields: backupType, targetDatabase',
    );
  });

  it('should fail for unsupported backup type', async () => {
    const mockJob = {
      id: '1',
      name: 'backup',
      data: { backupType: 'unknown-type', targetDatabase: 'main_db' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    await expect(worker.handle(mockJob)).rejects.toThrow('Unsupported backup type: unknown-type');
  });

  it('should support compression', async () => {
    const mockJob = {
      id: '1',
      name: 'backup-data',
      data: {
        backupType: 'full',
        targetDatabase: 'main_db',
        compression: true,
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.compressed).toBe(true);
  });

  it('should support encryption', async () => {
    const mockJob = {
      id: '1',
      name: 'backup-data',
      data: {
        backupType: 'full',
        targetDatabase: 'main_db',
        encryption: true,
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.encrypted).toBe(true);
  });
});
