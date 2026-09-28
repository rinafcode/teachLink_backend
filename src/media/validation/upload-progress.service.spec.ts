import { Test, TestingModule } from '@nestjs/testing';
import { UploadProgressService } from './upload-progress.service';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import { createMockRedisClient } from '../../../test/utils/mock-factories';

describe('UploadProgressService', () => {
  let service: UploadProgressService;
  let redis: ReturnType<typeof createMockRedisClient>;

  beforeEach(async () => {
    redis = createMockRedisClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadProgressService, { provide: REDIS_CLIENT, useValue: redis }],
    }).compile();

    service = module.get<UploadProgressService>(UploadProgressService);
  });

  it('initializes upload progress and persists it via the shared Redis client', async () => {
    (redis.setex as jest.Mock).mockResolvedValue('OK');

    const progress = await service.initializeUpload('upload-1', 'file.mp4', 1024);

    expect(progress).toMatchObject({
      uploadId: 'upload-1',
      status: 'pending',
      progress: 0,
      fileName: 'file.mp4',
      fileSize: 1024,
    });
    expect(redis.setex).toHaveBeenCalledWith(
      expect.stringContaining('upload-1'),
      expect.any(Number),
      expect.any(String),
    );
  });

  it('returns null when progress is not found', async () => {
    (redis.get as jest.Mock).mockResolvedValue(null);

    const progress = await service.getProgress('missing');

    expect(progress).toBeNull();
  });

  it('marks an upload completed once progress reaches 100', async () => {
    const stored = {
      uploadId: 'upload-2',
      status: 'uploading',
      progress: 50,
      fileName: 'file.mp4',
      fileSize: 2048,
      bytesProcessed: 1024,
      stage: 'uploading',
      message: 'uploading',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(stored));
    (redis.setex as jest.Mock).mockResolvedValue('OK');

    const updated = await service.updateProgress('upload-2', { progress: 100 });

    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeDefined();
  });

  it('deletes upload progress via the shared Redis client', async () => {
    (redis.del as jest.Mock).mockResolvedValue(1);

    await service.deleteProgress('upload-3');

    expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('upload-3'));
  });

  it('lists only active (non-terminal) uploads', async () => {
    const active = {
      uploadId: 'upload-4',
      status: 'processing',
      progress: 40,
      fileName: 'a.mp4',
      fileSize: 10,
      bytesProcessed: 4,
      stage: 'processing',
      message: '',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const completed = { ...active, uploadId: 'upload-5', status: 'completed' };

    (redis.keys as jest.Mock).mockResolvedValue(['upload:upload-4', 'upload:upload-5']);
    (redis.mget as jest.Mock).mockResolvedValue([
      JSON.stringify(active),
      JSON.stringify(completed),
    ]);

    const uploads = await service.listActiveUploads();

    expect(uploads).toHaveLength(1);
    expect(uploads[0].uploadId).toBe('upload-4');
  });

  it('returns zeroed statistics when no uploads exist', async () => {
    (redis.keys as jest.Mock).mockResolvedValue([]);

    const stats = await service.getStatistics();

    expect(stats.total).toBe(0);
    expect(stats.completed).toBe(0);
  });
});
