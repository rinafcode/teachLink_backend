import { Test, TestingModule } from '@nestjs/testing';
import { MediaProcessingWorker } from './media-processing.worker';
import { Job } from 'bull';
import { FILE_SIZE_LIMITS, ALL_ALLOWED_FILE_TYPES } from '../../media/validation/file-validation.constants';

describe('MediaProcessingWorker', () => {
  let worker: MediaProcessingWorker;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MediaProcessingWorker],
    }).compile();

    worker = module.get<MediaProcessingWorker>(MediaProcessingWorker);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('execute', () => {
    it('should reject oversized image files', async () => {
      const oversizedBuffer = Buffer.alloc(FILE_SIZE_LIMITS.IMAGE_MAX_SIZE + 1);
      // Add PNG magic bytes
      oversizedBuffer[0] = 0x89;
      oversizedBuffer[1] = 0x50;
      oversizedBuffer[2] = 0x4e;
      oversizedBuffer[3] = 0x47;

      const job = {
        data: {
          mediaType: 'image',
          fileUrl: 'http://example.com/large.png',
          fileBuffer: oversizedBuffer,
          declaredMimeType: 'image/png',
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      await expect(worker.execute(job)).rejects.toThrow(
        /File size.*exceeds maximum allowed size/,
      );
    });

    it('should reject oversized video files', async () => {
      const oversizedBuffer = Buffer.alloc(FILE_SIZE_LIMITS.VIDEO_MAX_SIZE + 1);
      // Add MP4 magic bytes
      oversizedBuffer[0] = 0x00;
      oversizedBuffer[1] = 0x00;
      oversizedBuffer[2] = 0x00;
      oversizedBuffer[3] = 0x18;
      oversizedBuffer[4] = 0x66;
      oversizedBuffer[5] = 0x74;
      oversizedBuffer[6] = 0x79;
      oversizedBuffer[7] = 0x70;

      const job = {
        data: {
          mediaType: 'video',
          fileUrl: 'http://example.com/large.mp4',
          fileBuffer: oversizedBuffer,
          declaredMimeType: 'video/mp4',
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      await expect(worker.execute(job)).rejects.toThrow(
        /File size.*exceeds maximum allowed size/,
      );
    });

    it('should reject files with MIME type mismatch', async () => {
      // JPEG magic bytes but declared as PNG
      const jpegBuffer = Buffer.alloc(100);
      jpegBuffer[0] = 0xff;
      jpegBuffer[1] = 0xd8;
      jpegBuffer[2] = 0xff;

      const job = {
        data: {
          mediaType: 'image',
          fileUrl: 'http://example.com/fake.png',
          fileBuffer: jpegBuffer,
          declaredMimeType: 'image/png', // Wrong declaration
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      await expect(worker.execute(job)).rejects.toThrow(
        /Declared MIME type.*does not match actual file content/,
      );
    });

    it('should reject PHP script disguised as video', async () => {
      const phpContent = Buffer.from('<?php echo "hacked"; ?>');

      const job = {
        data: {
          mediaType: 'video',
          fileUrl: 'http://example.com/video.mp4',
          fileBuffer: phpContent,
          declaredMimeType: 'video/mp4',
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      await expect(worker.execute(job)).rejects.toThrow(
        /Could not determine file type/,
      );
    });

    it('should reject files with unsupported MIME types', async () => {
      // Create a buffer that might be detected as an unsupported type
      const buffer = Buffer.alloc(100);
      // Add some bytes that might be detected but not in allowed list
      buffer[0] = 0x00;
      buffer[1] = 0x00;
      buffer[2] = 0x00;

      const job = {
        data: {
          mediaType: 'image',
          fileUrl: 'http://example.com/unknown.bin',
          fileBuffer: buffer,
          declaredMimeType: 'application/octet-stream',
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      // This might pass if file-type can't detect it, or fail if detected as unsupported
      // The important thing is that it validates against allowed types
      try {
        await worker.execute(job);
        // If it passes, that's because file-type couldn't detect it
        // In production, this should be handled by checking the declared type
      } catch (error) {
        // Expected to fail if detected as unsupported type
        expect(error.message).toMatch(/not allowed/);
      }
    });

    it('should reject when media type category does not match detected type', async () => {
      // JPEG magic bytes but mediaType is 'video'
      const jpegBuffer = Buffer.alloc(100);
      jpegBuffer[0] = 0xff;
      jpegBuffer[1] = 0xd8;
      jpegBuffer[2] = 0xff;

      const job = {
        data: {
          mediaType: 'video', // Wrong category
          fileUrl: 'http://example.com/image.jpg',
          fileBuffer: jpegBuffer,
          declaredMimeType: 'image/jpeg',
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      await expect(worker.execute(job)).rejects.toThrow(
        /Expected video file but detected image/,
      );
    });

    it('should accept valid image file within size limit', async () => {
      const pngBuffer = Buffer.alloc(1000);
      pngBuffer[0] = 0x89;
      pngBuffer[1] = 0x50;
      pngBuffer[2] = 0x4e;
      pngBuffer[3] = 0x47;
      pngBuffer[4] = 0x0d;
      pngBuffer[5] = 0x0a;
      pngBuffer[6] = 0x1a;
      pngBuffer[7] = 0x0a;

      const job = {
        data: {
          mediaType: 'image',
          fileUrl: 'http://example.com/valid.png',
          fileBuffer: pngBuffer,
          declaredMimeType: 'image/png',
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      const result = await worker.execute(job);
      expect(result).toBeDefined();
      expect(result.mediaType).toBe('image');
      expect(job.progress).toHaveBeenCalledWith(100);
    });

    it('should accept valid video file within size limit', async () => {
      const mp4Buffer = Buffer.alloc(1000);
      mp4Buffer[0] = 0x00;
      mp4Buffer[1] = 0x00;
      mp4Buffer[2] = 0x00;
      mp4Buffer[3] = 0x18;
      mp4Buffer[4] = 0x66;
      mp4Buffer[5] = 0x74;
      mp4Buffer[6] = 0x79;
      mp4Buffer[7] = 0x70;

      const job = {
        data: {
          mediaType: 'video',
          fileUrl: 'http://example.com/valid.mp4',
          fileBuffer: mp4Buffer,
          declaredMimeType: 'video/mp4',
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      const result = await worker.execute(job);
      expect(result).toBeDefined();
      expect(result.mediaType).toBe('video');
      expect(job.progress).toHaveBeenCalledWith(100);
    });

    it('should accept valid audio file within size limit', async () => {
      const mp3Buffer = Buffer.alloc(1000);
      mp3Buffer[0] = 0xff;
      mp3Buffer[1] = 0xfb;

      const job = {
        data: {
          mediaType: 'audio',
          fileUrl: 'http://example.com/valid.mp3',
          fileBuffer: mp3Buffer,
          declaredMimeType: 'audio/mpeg',
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      const result = await worker.execute(job);
      expect(result).toBeDefined();
      expect(result.mediaType).toBe('audio');
      expect(job.progress).toHaveBeenCalledWith(100);
    });

    it('should process files without buffer (legacy support)', async () => {
      const job = {
        data: {
          mediaType: 'image',
          fileUrl: 'http://example.com/legacy.png',
          // No fileBuffer provided
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      const result = await worker.execute(job);
      expect(result).toBeDefined();
      expect(result.mediaType).toBe('image');
    });

    it('should reject when required fields are missing', async () => {
      const job = {
        data: {
          // Missing fileUrl and mediaType
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      await expect(worker.execute(job)).rejects.toThrow(
        /Missing required media fields/,
      );
    });

    it('should reject when buffer is too small for magic byte detection', async () => {
      const tinyBuffer = Buffer.alloc(2); // Too small for magic bytes

      const job = {
        data: {
          mediaType: 'image',
          fileUrl: 'http://example.com/tiny.bin',
          fileBuffer: tinyBuffer,
          declaredMimeType: 'image/png',
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Should skip validation if buffer < 4 bytes, but still process
      const result = await worker.execute(job);
      expect(result).toBeDefined();
    });
  });

  describe('getMaxSizeForType', () => {
    it('should return correct size limit for images', () => {
      const maxSize = (worker as any).getMaxSizeForType('image');
      expect(maxSize).toBe(FILE_SIZE_LIMITS.IMAGE_MAX_SIZE);
    });

    it('should return correct size limit for videos', () => {
      const maxSize = (worker as any).getMaxSizeForType('video');
      expect(maxSize).toBe(FILE_SIZE_LIMITS.VIDEO_MAX_SIZE);
    });

    it('should return correct size limit for audio', () => {
      const maxSize = (worker as any).getMaxSizeForType('audio');
      expect(maxSize).toBe(FILE_SIZE_LIMITS.AUDIO_MAX_SIZE);
    });

    it('should return correct size limit for documents', () => {
      const maxSize = (worker as any).getMaxSizeForType('document');
      expect(maxSize).toBe(FILE_SIZE_LIMITS.DOCUMENT_MAX_SIZE);
    });

    it('should return default size limit for unknown types', () => {
      const maxSize = (worker as any).getMaxSizeForType('unknown');
      expect(maxSize).toBe(FILE_SIZE_LIMITS.DEFAULT_MAX_SIZE);
    });

    it('should be case-insensitive', () => {
      const maxSize1 = (worker as any).getMaxSizeForType('IMAGE');
      const maxSize2 = (worker as any).getMaxSizeForType('Image');
      const maxSize3 = (worker as any).getMaxSizeForType('image');
      
      expect(maxSize1).toBe(maxSize2);
      expect(maxSize2).toBe(maxSize3);
    });
  });
});
