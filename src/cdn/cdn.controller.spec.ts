import { Test, TestingModule } from '@nestjs/testing';
import { CdnController } from './cdn.controller';
import { PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { FILE_SIZE_LIMITS } from '../media/validation/file-validation.constants';

describe('CdnController', () => {
  let controller: CdnController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CdnController],
    }).compile();

    controller = module.get<CdnController>(CdnController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadContent', () => {
    it('should reject files exceeding image size limit', async () => {
      // Create a buffer larger than IMAGE_MAX_SIZE (20MB)
      const oversizedBuffer = Buffer.alloc(FILE_SIZE_LIMITS.IMAGE_MAX_SIZE + 1);
      // Add PNG magic bytes
      oversizedBuffer[0] = 0x89;
      oversizedBuffer[1] = 0x50;
      oversizedBuffer[2] = 0x4e;
      oversizedBuffer[3] = 0x47;
      oversizedBuffer[4] = 0x0d;
      oversizedBuffer[5] = 0x0a;
      oversizedBuffer[6] = 0x1a;
      oversizedBuffer[7] = 0x0a;

      const file = {
        fieldname: 'file',
        originalname: 'large.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: FILE_SIZE_LIMITS.IMAGE_MAX_SIZE + 1,
        buffer: oversizedBuffer,
      } as Express.Multer.File;

      await expect(controller.uploadContent(file)).rejects.toThrow(PayloadTooLargeException);
    });

    it('should reject files exceeding video size limit', async () => {
      // Create a buffer larger than VIDEO_MAX_SIZE (500MB)
      const oversizedBuffer = Buffer.alloc(FILE_SIZE_LIMITS.VIDEO_MAX_SIZE + 1);
      // Add MP4 magic bytes (ftyp)
      oversizedBuffer[0] = 0x00;
      oversizedBuffer[1] = 0x00;
      oversizedBuffer[2] = 0x00;
      oversizedBuffer[3] = 0x18;
      oversizedBuffer[4] = 0x66;
      oversizedBuffer[5] = 0x74;
      oversizedBuffer[6] = 0x79;
      oversizedBuffer[7] = 0x70;

      const file = {
        fieldname: 'file',
        originalname: 'large.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: FILE_SIZE_LIMITS.VIDEO_MAX_SIZE + 1,
        buffer: oversizedBuffer,
      } as Express.Multer.File;

      await expect(controller.uploadContent(file)).rejects.toThrow(PayloadTooLargeException);
    });

    it('should reject files with wrong magic bytes (MIME mismatch)', async () => {
      // Create a file with PNG extension but JPEG magic bytes
      const jpegBuffer = Buffer.alloc(100);
      jpegBuffer[0] = 0xff;
      jpegBuffer[1] = 0xd8;
      jpegBuffer[2] = 0xff;

      const file = {
        fieldname: 'file',
        originalname: 'fake.png',
        encoding: '7bit',
        mimetype: 'image/png', // Declared as PNG
        size: 100,
        buffer: jpegBuffer, // But actually JPEG
      } as Express.Multer.File;

      await expect(controller.uploadContent(file)).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('should reject PHP script disguised as video', async () => {
      // Create a PHP script with video.mp4 name
      const phpContent = Buffer.from('<?php echo "hacked"; ?>');
      const file = {
        fieldname: 'file',
        originalname: 'video.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: phpContent.length,
        buffer: phpContent,
      } as Express.Multer.File;

      await expect(controller.uploadContent(file)).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('should accept valid PNG file within size limit', async () => {
      // Create a valid PNG file within size limit
      const pngBuffer = Buffer.alloc(1000);
      pngBuffer[0] = 0x89;
      pngBuffer[1] = 0x50;
      pngBuffer[2] = 0x4e;
      pngBuffer[3] = 0x47;
      pngBuffer[4] = 0x0d;
      pngBuffer[5] = 0x0a;
      pngBuffer[6] = 0x1a;
      pngBuffer[7] = 0x0a;

      const file = {
        fieldname: 'file',
        originalname: 'valid.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 1000,
        buffer: pngBuffer,
      } as Express.Multer.File;

      const result = await controller.uploadContent(file);
      expect(result.success).toBe(true);
      expect(result.file.mimetype).toBe('image/png');
      expect(result.file.extension).toBe('png');
    });

    it('should accept valid JPEG file within size limit', async () => {
      // Create a valid JPEG file within size limit
      const jpegBuffer = Buffer.alloc(1000);
      jpegBuffer[0] = 0xff;
      jpegBuffer[1] = 0xd8;
      jpegBuffer[2] = 0xff;

      const file = {
        fieldname: 'file',
        originalname: 'valid.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1000,
        buffer: jpegBuffer,
      } as Express.Multer.File;

      const result = await controller.uploadContent(file);
      expect(result.success).toBe(true);
      expect(result.file.mimetype).toBe('image/jpeg');
      expect(result.file.extension).toBe('jpg');
    });

    it('should accept valid MP4 file within size limit', async () => {
      // Create a valid MP4 file within size limit
      const mp4Buffer = Buffer.alloc(1000);
      mp4Buffer[0] = 0x00;
      mp4Buffer[1] = 0x00;
      mp4Buffer[2] = 0x00;
      mp4Buffer[3] = 0x18;
      mp4Buffer[4] = 0x66;
      mp4Buffer[5] = 0x74;
      mp4Buffer[6] = 0x79;
      mp4Buffer[7] = 0x70;

      const file = {
        fieldname: 'file',
        originalname: 'valid.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: 1000,
        buffer: mp4Buffer,
      } as Express.Multer.File;

      const result = await controller.uploadContent(file);
      expect(result.success).toBe(true);
      expect(result.file.mimetype).toBe('video/mp4');
      expect(result.file.extension).toBe('mp4');
    });

    it('should reject file with no magic bytes', async () => {
      // Create a buffer with no recognizable magic bytes
      const invalidBuffer = Buffer.alloc(100, 0x00);

      const file = {
        fieldname: 'file',
        originalname: 'invalid.bin',
        encoding: '7bit',
        mimetype: 'application/octet-stream',
        size: 100,
        buffer: invalidBuffer,
      } as Express.Multer.File;

      await expect(controller.uploadContent(file)).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('should reject when no file is provided', async () => {
      await expect(controller.uploadContent(null as any)).rejects.toThrow();
    });
  });

  describe('getMaxSizeForType', () => {
    it('should return correct size limit for images', () => {
      const maxSize = (controller as any).getMaxSizeForType('image/jpeg');
      expect(maxSize).toBe(FILE_SIZE_LIMITS.IMAGE_MAX_SIZE);
    });

    it('should return correct size limit for videos', () => {
      const maxSize = (controller as any).getMaxSizeForType('video/mp4');
      expect(maxSize).toBe(FILE_SIZE_LIMITS.VIDEO_MAX_SIZE);
    });

    it('should return correct size limit for audio', () => {
      const maxSize = (controller as any).getMaxSizeForType('audio/mpeg');
      expect(maxSize).toBe(FILE_SIZE_LIMITS.AUDIO_MAX_SIZE);
    });

    it('should return default size limit for unknown types', () => {
      const maxSize = (controller as any).getMaxSizeForType('unknown/type');
      expect(maxSize).toBe(FILE_SIZE_LIMITS.DEFAULT_MAX_SIZE);
    });
  });
});
