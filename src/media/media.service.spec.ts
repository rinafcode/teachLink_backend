import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ContentStatus } from '../cdn/entities/content-metadata.entity';
import { MediaService } from './media.service';

describe('MediaService', () => {
  let service: MediaService;
  let contentRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let storage: { uploadFile: jest.Mock; uploadProcessedFile: jest.Mock };
  let videoProcessing: { enqueueTranscode: jest.Mock };
  let fileValidation: { validateFile: jest.Mock };
  let malwareScanning: { isScanningAvailable: jest.Mock; scanFile: jest.Mock };
  let imageProcessing: { compressImage: jest.Mock; generateThumbnails: jest.Mock };
  let uploadProgress: {
    initializeUpload: jest.Mock;
    updateProgress: jest.Mock;
    markFailed: jest.Mock;
    markCompleted: jest.Mock;
    getProgress: jest.Mock;
    listActiveUploads: jest.Mock;
    getStatistics: jest.Mock;
  };

  const file = {
    originalname: 'avatar.png',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('png'),
  };

  beforeEach(() => {
    contentRepo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({
        status: ContentStatus.READY,
        ...value,
      })),
      findOne: jest.fn(),
    };
    storage = {
      uploadFile: jest.fn(),
      uploadProcessedFile: jest.fn(),
    };
    videoProcessing = {
      enqueueTranscode: jest.fn(),
    };
    fileValidation = {
      validateFile: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        metadata: {},
      }),
    };
    malwareScanning = {
      isScanningAvailable: jest.fn(),
      scanFile: jest.fn(),
    };
    imageProcessing = {
      compressImage: jest.fn(),
      generateThumbnails: jest.fn(),
    };
    uploadProgress = {
      initializeUpload: jest.fn(),
      updateProgress: jest.fn(),
      markFailed: jest.fn(),
      markCompleted: jest.fn(),
      getProgress: jest.fn(),
      listActiveUploads: jest.fn(),
      getStatistics: jest.fn(),
    };

    service = new MediaService(
      contentRepo as any,
      storage as any,
      videoProcessing as any,
      fileValidation as any,
      malwareScanning as any,
      imageProcessing as any,
      uploadProgress as any,
    );
  });

  it('fails closed when malware scanning is required but unavailable', async () => {
    malwareScanning.isScanningAvailable.mockReturnValue(false);

    await expect(
      service.createFromUpload('user-1', 'tenant-1', file as any),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(malwareScanning.scanFile).not.toHaveBeenCalled();
    expect(uploadProgress.markFailed).toHaveBeenCalled();
  });

  it('blocks uploads when malware is detected', async () => {
    malwareScanning.isScanningAvailable.mockReturnValue(true);
    malwareScanning.scanFile.mockResolvedValue({
      clean: false,
      threats: ['EICAR-Test-File'],
      scanTime: 42,
    });

    await expect(
      service.createFromUpload('user-1', 'tenant-1', file as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(uploadProgress.markFailed).toHaveBeenCalledWith(
      expect.any(String),
      'Malware detected: EICAR-Test-File',
    );
  });
});
