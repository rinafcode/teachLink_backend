import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ContentStatus } from '../cdn/entities/content-metadata.entity';
import { MediaService } from './media.service';

describe('MediaService', () => {
  // ─── Declarations ──────────────────────────────────────────────────────────
  let service: MediaService;
  let mockContentRepo: jest.Mocked<any>;
  let mockStorage: jest.Mocked<any>;
  let mockVideoProcessing: jest.Mocked<any>;
  let mockFileValidation: jest.Mocked<any>;
  let mockMalwareScanning: jest.Mocked<any>;
  let mockImageProcessing: jest.Mocked<any>;
  let mockUploadProgress: jest.Mocked<any>;

  const file = {
    originalname: 'avatar.png',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('png'),
  };

  // ─── Setup ─────────────────────────────────────────────────────────────────
  beforeEach(() => {
    // Initialize all dependency mocks with proper typing
    mockContentRepo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({
        status: ContentStatus.READY,
        ...value,
      })),
      findOne: jest.fn(),
    } as jest.Mocked<any>;

    mockStorage = {
      uploadFile: jest.fn(),
      uploadProcessedFile: jest.fn(),
    } as jest.Mocked<any>;

    mockVideoProcessing = {
      enqueueTranscode: jest.fn(),
    } as jest.Mocked<any>;

    mockFileValidation = {
      validateFile: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        metadata: {},
      }),
    } as jest.Mocked<any>;

    mockMalwareScanning = {
      isScanningAvailable: jest.fn(),
      scanFile: jest.fn(),
    } as jest.Mocked<any>;

    mockImageProcessing = {
      compressImage: jest.fn(),
      generateThumbnails: jest.fn(),
    } as jest.Mocked<any>;

    mockUploadProgress = {
      initializeUpload: jest.fn(),
      updateProgress: jest.fn(),
      markFailed: jest.fn(),
      markCompleted: jest.fn(),
      getProgress: jest.fn(),
      listActiveUploads: jest.fn(),
      getStatistics: jest.fn(),
    } as jest.Mocked<any>;

    service = new MediaService(
      mockContentRepo,
      mockStorage,
      mockVideoProcessing,
      mockFileValidation,
      mockMalwareScanning,
      mockImageProcessing,
      mockUploadProgress,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fails closed when malware scanning is required but unavailable', async () => {
    mockMalwareScanning.isScanningAvailable.mockReturnValue(false);

    await expect(
      service.createFromUpload('user-1', 'tenant-1', file as any),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(mockMalwareScanning.scanFile).not.toHaveBeenCalled();
    expect(mockUploadProgress.markFailed).toHaveBeenCalled();
  });

  it('blocks uploads when malware is detected', async () => {
    mockMalwareScanning.isScanningAvailable.mockReturnValue(true);
    mockMalwareScanning.scanFile.mockResolvedValue({
      clean: false,
      threats: ['EICAR-Test-File'],
      scanTime: 42,
    });

    await expect(
      service.createFromUpload('user-1', 'tenant-1', file as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockUploadProgress.markFailed).toHaveBeenCalledWith(
      expect.any(String),
      'Malware detected: EICAR-Test-File',
    );
  });
});
