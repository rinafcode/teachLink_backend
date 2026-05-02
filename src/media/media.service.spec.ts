import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ContentStatus } from '../cdn/entities/content-metadata.entity';
import { MediaService } from './media.service';
describe('MediaService', () => {
    // ─── Declarations ──────────────────────────────────────────────────────────
    let service: MediaService;
    let mockContentRepo: jest.Mocked<unknown>;
    let mockStorage: jest.Mocked<unknown>;
    let mockVideoProcessing: jest.Mocked<unknown>;
    let mockFileValidation: jest.Mocked<unknown>;
    let mockMalwareScanning: jest.Mocked<unknown>;
    let mockImageProcessing: jest.Mocked<unknown>;
    let mockUploadProgress: jest.Mocked<unknown>;
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
        } as jest.Mocked<unknown>;
        mockStorage = {
            uploadFile: jest.fn(),
            uploadProcessedFile: jest.fn(),
        } as jest.Mocked<unknown>;
        mockVideoProcessing = {
            enqueueTranscode: jest.fn(),
        } as jest.Mocked<unknown>;
        mockFileValidation = {
            validateFile: jest.fn().mockResolvedValue({
                valid: true,
                errors: [],
                warnings: [],
                metadata: {},
            }),
        } as jest.Mocked<unknown>;
        mockMalwareScanning = {
            isScanningAvailable: jest.fn(),
            scanFile: jest.fn(),
        } as jest.Mocked<unknown>;
        mockImageProcessing = {
            compressImage: jest.fn(),
            generateThumbnails: jest.fn(),
        } as jest.Mocked<unknown>;
        mockUploadProgress = {
            initializeUpload: jest.fn(),
            updateProgress: jest.fn(),
            markFailed: jest.fn(),
            markCompleted: jest.fn(),
            getProgress: jest.fn(),
            listActiveUploads: jest.fn(),
            getStatistics: jest.fn(),
        } as jest.Mocked<unknown>;
        service = new MediaService(mockContentRepo, mockStorage, mockVideoProcessing, mockFileValidation, mockMalwareScanning, mockImageProcessing, mockUploadProgress);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('fails closed when malware scanning is required but unavailable', async () => {
        mockMalwareScanning.isScanningAvailable.mockReturnValue(false);
        await expect(service.createFromUpload('user-1', 'tenant-1', file as unknown)).rejects.toBeInstanceOf(ServiceUnavailableException);
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
        await expect(service.createFromUpload('user-1', 'tenant-1', file as unknown)).rejects.toBeInstanceOf(ForbiddenException);
        expect(mockUploadProgress.markFailed).toHaveBeenCalledWith(expect.any(String), 'Malware detected: EICAR-Test-File');
    });
});
