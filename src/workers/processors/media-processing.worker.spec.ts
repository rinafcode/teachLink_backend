import { MediaProcessingWorker } from './media-processing.worker';
import { Job } from 'bull';

describe('MediaProcessingWorker', () => {
  let worker: MediaProcessingWorker;

  beforeEach(() => {
    worker = new MediaProcessingWorker();
  });

  describe('image processing', () => {
    it('should process image job', async () => {
      const mockJob = {
        id: '1',
        name: 'process-image',
        data: {
          mediaType: 'image',
          fileUrl: 's3://bucket/image.jpg',
          format: 'webp',
        },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await worker.handle(mockJob);

      expect(result.success).toBe(true);
      expect(result.data.mediaType).toBe('image');
      expect(result.data.optimized).toBe(true);
    });
  });

  describe('video processing', () => {
    it('should process video job', async () => {
      const mockJob = {
        id: '1',
        name: 'process-video',
        data: {
          mediaType: 'video',
          fileUrl: 's3://bucket/video.mov',
          format: 'mp4',
        },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await worker.handle(mockJob);

      expect(result.success).toBe(true);
      expect(result.data.mediaType).toBe('video');
      expect(result.data.transcoded).toBe(true);
    });
  });

  describe('audio processing', () => {
    it('should process audio job', async () => {
      const mockJob = {
        id: '1',
        name: 'process-audio',
        data: {
          mediaType: 'audio',
          fileUrl: 's3://bucket/audio.wav',
          format: 'mp3',
        },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await worker.handle(mockJob);

      expect(result.success).toBe(true);
      expect(result.data.mediaType).toBe('audio');
      expect(result.data.processed).toBe(true);
    });
  });

  describe('validation', () => {
    it('should fail if mediaType is missing', async () => {
      const mockJob = {
        id: '1',
        name: 'process-media',
        data: {
          fileUrl: 's3://bucket/file.jpg',
          // missing mediaType
        },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      await expect(worker.handle(mockJob)).rejects.toThrow(
        'Missing required media fields: fileUrl, mediaType',
      );
    });

    it('should fail if fileUrl is missing', async () => {
      const mockJob = {
        id: '1',
        name: 'process-media',
        data: {
          mediaType: 'image',
          // missing fileUrl
        },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      await expect(worker.handle(mockJob)).rejects.toThrow(
        'Missing required media fields: fileUrl, mediaType',
      );
    });

    it('should fail for unsupported media type', async () => {
      const mockJob = {
        id: '1',
        name: 'process-media',
        data: {
          mediaType: 'unsupported-type',
          fileUrl: 's3://bucket/file.xxx',
        },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      await expect(worker.handle(mockJob)).rejects.toThrow(
        'Unsupported media type: unsupported-type',
      );
    });
  });

  describe('metrics', () => {
    it('should track successful processing', async () => {
      const mockJob = {
        id: '1',
        name: 'process-image',
        data: { mediaType: 'image', fileUrl: 's3://bucket/image.jpg' },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      await worker.handle(mockJob);

      const metrics = worker.getMetrics();
      expect(metrics.jobsProcessed).toBe(1);
      expect(metrics.jobsSucceeded).toBe(1);
      expect(metrics.jobsFailed).toBe(0);
    });
  });
});
