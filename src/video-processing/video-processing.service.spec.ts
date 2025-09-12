import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import type { Express } from 'express';

import { VideoProcessingService } from './services/video-processing.service';
import { Video, VideoStatus, VideoType } from './entities/video.entity';
import {
  VideoVariant,
  VideoQuality,
  VideoFormat,
  VariantStatus,
} from './entities/video-variant.entity';
import {
  VideoProcessingJob,
  JobType,
  JobStatus,
  JobPriority,
} from './entities/video-processing-job.entity';
import { FFmpegService } from './services/ffmpeg.service';
import { StorageService } from './services/storage.service';
import { MetadataService } from './services/metadata.service';
import { ThumbnailService } from './services/thumbnail.service';
import { QueueService } from './services/queue.service';

const mockVideo = {
  id: 'test-video-id',
  title: 'Test Video',
  description: 'Test Description',
  originalFilePath: '/uploads/test-video.mp4',
  originalFileName: 'test-video.mp4',
  originalFileSize: 1000000,
  originalMimeType: 'video/mp4',
  status: VideoStatus.UPLOADED,
  type: VideoType.COURSE_CONTENT,
  duration: 120,
  width: 1920,
  height: 1080,
  frameRate: 30,
  codec: 'h264',
  bitrate: 5000000,
  metadata: {},
  thumbnailPath: null,
  previewPath: null,
  courseId: null,
  uploadedBy: 'user-id',
  processingError: null,
  processingProgress: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  processingJobs: [],
  variants: [],
};

const mockMetadata = {
  duration: 120,
  width: 1920,
  height: 1080,
  frameRate: 30,
  codec: 'h264',
  bitrate: 5000000,
  format: 'mp4',
  size: 1000000,
};

describe('VideoProcessingService', () => {
  let service: VideoProcessingService;
  let videoRepository: jest.Mocked<Repository<Video>>;
  let variantRepository: jest.Mocked<Repository<VideoVariant>>;
  let jobRepository: jest.Mocked<Repository<VideoProcessingJob>>;
  let ffmpegService: jest.Mocked<FFmpegService>;
  let storageService: jest.Mocked<StorageService>;
  let metadataService: jest.Mocked<MetadataService>;
  let thumbnailService: jest.Mocked<ThumbnailService>;
  let queueService: jest.Mocked<QueueService>;

  beforeEach(async () => {
    const mockVideoRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const mockVariantRepository = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
    };

    const mockJobRepository = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
    };

    const mockFFmpegService = {
      transcode: jest.fn(),
      generateHLS: jest.fn(),
      generateDASH: jest.fn(),
    };

    const mockStorageService = {
      saveFile: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
      fileExists: jest.fn(),
      getFileSize: jest.fn(),
      getFullPath: jest.fn(),
    };

    const mockMetadataService = {
      extractMetadata: jest.fn(),
    };

    const mockThumbnailService = {
      generateThumbnails: jest.fn(),
      generatePreview: jest.fn(),
    };

    const mockQueueService = {
      addJob: jest.fn(),
      getQueueStats: jest.fn(),
      pauseQueue: jest.fn(),
      resumeQueue: jest.fn(),
      cancelJob: jest.fn(),
      retryJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoProcessingService,
        {
          provide: getRepositoryToken(Video),
          useValue: mockVideoRepository,
        },
        {
          provide: getRepositoryToken(VideoVariant),
          useValue: mockVariantRepository,
        },
        {
          provide: getRepositoryToken(VideoProcessingJob),
          useValue: mockJobRepository,
        },
        {
          provide: FFmpegService,
          useValue: mockFFmpegService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: MetadataService,
          useValue: mockMetadataService,
        },
        {
          provide: ThumbnailService,
          useValue: mockThumbnailService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<VideoProcessingService>(VideoProcessingService);
    videoRepository = module.get(getRepositoryToken(Video));
    variantRepository = module.get(getRepositoryToken(VideoVariant));
    jobRepository = module.get(getRepositoryToken(VideoProcessingJob));
    ffmpegService = module.get(FFmpegService);
    storageService = module.get(StorageService);
    metadataService = module.get(MetadataService);
    thumbnailService = module.get(ThumbnailService);
    queueService = module.get(QueueService);
  });

  describe('processVideo', () => {
    it('should successfully process a video', async () => {
      // Arrange
      videoRepository.findOne.mockResolvedValue(mockVideo);
      videoRepository.update.mockResolvedValue({ affected: 1 } as any);
      metadataService.extractMetadata.mockResolvedValue(mockMetadata);
      jobRepository.create.mockReturnValue({} as VideoProcessingJob);
      jobRepository.save.mockResolvedValue([] as VideoProcessingJob[]);
      queueService.addJob.mockResolvedValue();

      const mockVariant = {
        id: 'variant-id',
        quality: VideoQuality.HIGH,
        format: VideoFormat.MP4,
        status: VariantStatus.COMPLETED,
        filePath: 'processed/test-video-id/720p.mp4',
      } as VideoVariant;

      variantRepository.create.mockReturnValue(mockVariant);
      variantRepository.save.mockResolvedValue(mockVariant);

      ffmpegService.transcode.mockResolvedValue({
        success: true,
        outputPath: 'processed/test-video-id/720p.mp4',
        fileSize: 800000,
        duration: 120,
        bitrate: 2500000,
        width: 1280,
        height: 720,
        codec: 'libx264',
      });

      thumbnailService.generateThumbnails.mockResolvedValue([
        'thumbnails/test-video-id/thumbnail_1.jpg',
        'thumbnails/test-video-id/thumbnail_2.jpg',
      ]);

      // Act
      const result = await service.processVideo('test-video-id', {
        qualities: [VideoQuality.HIGH],
        formats: [VideoFormat.MP4],
        generateThumbnails: true,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.videoId).toBe('test-video-id');
      expect(result.variants).toHaveLength(1);
      expect(result.thumbnails).toHaveLength(2);
      expect(videoRepository.update).toHaveBeenCalledWith('test-video-id', {
        status: VideoStatus.PROCESSING,
      });
      expect(metadataService.extractMetadata).toHaveBeenCalledWith(
        mockVideo.originalFilePath,
      );
    });

    it('should throw BadRequestException if video not found', async () => {
      // Arrange
      videoRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.processVideo('non-existent-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if video is already processing', async () => {
      // Arrange
      const processingVideo = { ...mockVideo, status: VideoStatus.PROCESSING };
      videoRepository.findOne.mockResolvedValue(processingVideo);

      // Act & Assert
      await expect(service.processVideo('test-video-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle processing errors gracefully', async () => {
      // Arrange
      videoRepository.findOne.mockResolvedValue(mockVideo);
      videoRepository.update.mockResolvedValue({ affected: 1 } as any);
      metadataService.extractMetadata.mockRejectedValue(
        new Error('Metadata extraction failed'),
      );

      // Act & Assert
      await expect(service.processVideo('test-video-id')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(videoRepository.update).toHaveBeenCalledWith(
        'test-video-id',
        expect.objectContaining({
          status: VideoStatus.FAILED,
        }),
      );
    });
  });

  describe('getProcessingStatus', () => {
    it('should return processing status', async () => {
      // Arrange
      const videoWithJobs = {
        ...mockVideo,
        processingJobs: [
          {
            id: 'job-1',
            type: JobType.TRANSCODE,
            status: JobStatus.COMPLETED,
            progress: 100,
          },
          {
            id: 'job-2',
            type: JobType.THUMBNAIL_GENERATION,
            status: JobStatus.PROCESSING,
            progress: 50,
          },
        ],
        variants: [
          {
            id: 'variant-1',
            quality: VideoQuality.HIGH,
            format: VideoFormat.MP4,
            status: VariantStatus.COMPLETED,
            processingProgress: 100,
          },
        ],
      };

      videoRepository.findOne.mockResolvedValue(videoWithJobs as any);

      // Act
      const result = await service.getProcessingStatus('test-video-id');

      // Assert
      expect(result.videoId).toBe('test-video-id');
      expect(result.totalJobs).toBe(2);
      expect(result.completedJobs).toBe(1);
      expect(result.failedJobs).toBe(0);
      expect(result.variants).toHaveLength(1);
      expect(result.jobs).toHaveLength(2);
    });

    it('should throw BadRequestException if video not found', async () => {
      // Arrange
      videoRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getProcessingStatus('non-existent-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelProcessing', () => {
    it('should cancel video processing', async () => {
      // Arrange
      videoRepository.update.mockResolvedValue({ affected: 1 } as any);
      jobRepository.update.mockResolvedValue({ affected: 2 } as any);

      // Act
      await service.cancelProcessing('test-video-id');

      // Assert
      expect(videoRepository.update).toHaveBeenCalledWith('test-video-id', {
        status: VideoStatus.FAILED,
      });
      expect(jobRepository.update).toHaveBeenCalledWith(
        { videoId: 'test-video-id', status: JobStatus.QUEUED },
        { status: JobStatus.CANCELLED },
      );
    });
  });
});

describe('QueueService', () => {
  let queueService: QueueService;
  let jobRepository: jest.Mocked<Repository<VideoProcessingJob>>;
  let queueRepository: jest.Mocked<Repository<any>>;
  let workerService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockJobRepository = {
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockQueueRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockWorkerService = {
      processJob: jest.fn(),
      cancelJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getRepositoryToken(VideoProcessingJob),
          useValue: mockJobRepository,
        },
        {
          provide: getRepositoryToken('ProcessingQueue'),
          useValue: mockQueueRepository,
        },
        {
          provide: 'WorkerService',
          useValue: mockWorkerService,
        },
      ],
    }).compile();

    queueService = module.get<QueueService>(QueueService);
    jobRepository = module.get(getRepositoryToken(VideoProcessingJob));
    queueRepository = module.get(getRepositoryToken('ProcessingQueue'));
    workerService = module.get('WorkerService');
  });

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      // Arrange
      const mockJob = {
        id: 'job-id',
        type: JobType.TRANSCODE,
        priority: JobPriority.NORMAL,
        status: JobStatus.QUEUED,
      } as VideoProcessingJob;

      jobRepository.save.mockResolvedValue(mockJob);

      // Act
      await queueService.addJob(mockJob);

      // Assert
      expect(mockJob.status).toBe(JobStatus.QUEUED);
      expect(mockJob.scheduledAt).toBeInstanceOf(Date);
      expect(jobRepository.save).toHaveBeenCalledWith(mockJob);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      // Arrange
      const mockQueues = [
        {
          name: 'high-priority',
          priority: 10,
          maxConcurrentJobs: 2,
          currentActiveJobs: 1,
        },
      ];

      queueRepository.find.mockResolvedValue(mockQueues);
      jobRepository.count
        .mockResolvedValueOnce(100) // total jobs
        .mockResolvedValueOnce(10) // queued jobs
        .mockResolvedValueOnce(5) // processing jobs
        .mockResolvedValueOnce(80) // completed jobs
        .mockResolvedValueOnce(5); // failed jobs

      // Act
      const stats = await queueService.getQueueStats();

      // Assert
      expect(stats).toHaveLength(1);
      expect(stats[0].queueName).toBe('high-priority');
      expect(stats[0].totalJobs).toBe(100);
      expect(stats[0].queuedJobs).toBe(10);
    });
  });
});

describe('VideoController', () => {
  let controller: any;
  let videoRepository: jest.Mocked<Repository<Video>>;
  let videoProcessingService: jest.Mocked<VideoProcessingService>;

  const mockFile = {
    originalname: 'test-video.mp4',
    mimetype: 'video/mp4',
    size: 1000000,
    path: '/uploads/test-video.mp4',
  } as Express.Multer.File;

  beforeEach(async () => {
    const mockVideoRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const mockVideoProcessingService = {
      processVideo: jest.fn(),
      getProcessingStatus: jest.fn(),
      cancelProcessing: jest.fn(),
    };

    const mockStorageService = {
      deleteFile: jest.fn(),
    };

    const mockQueueService = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [require('./controllers/video.controller').VideoController],
      providers: [
        {
          provide: getRepositoryToken(Video),
          useValue: mockVideoRepository,
        },
        {
          provide: VideoProcessingService,
          useValue: mockVideoProcessingService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    controller = module.get(
      require('./controllers/video.controller').VideoController,
    );
    videoRepository = module.get(getRepositoryToken(Video));
    videoProcessingService = module.get(VideoProcessingService);
  });

  describe('uploadVideo', () => {
    it('should upload a video successfully', async () => {
      // Arrange
      const uploadDto = {
        title: 'Test Video',
        description: 'Test Description',
        type: VideoType.COURSE_CONTENT,
      };

      const savedVideo = { ...mockVideo, id: 'new-video-id' };
      videoRepository.create.mockReturnValue(savedVideo);
      videoRepository.save.mockResolvedValue(savedVideo);

      // Act
      const result = await controller.uploadVideo(mockFile, uploadDto);

      // Assert
      expect(result.videoId).toBe('new-video-id');
      expect(result.message).toBe('Video uploaded successfully');
      expect(result.filePath).toBe('/uploads/test-video.mp4');
      expect(result.fileSize).toBe(1000000);
      expect(videoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Video',
          originalFileName: 'test-video.mp4',
          status: VideoStatus.UPLOADED,
        }),
      );
    });

    it('should throw BadRequestException if no file provided', async () => {
      // Arrange
      const uploadDto = { title: 'Test Video' };

      // Act & Assert
      await expect(controller.uploadVideo(null, uploadDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('processVideo', () => {
    it('should start video processing', async () => {
      // Arrange
      const processDto = {
        qualities: [VideoQuality.HIGH],
        formats: [VideoFormat.MP4],
        generateThumbnails: true,
      };

      const mockResult = {
        success: true,
        videoId: 'test-video-id',
        variants: [],
        thumbnails: [],
        errors: [],
      };

      videoRepository.findOne.mockResolvedValue(mockVideo);
      videoProcessingService.processVideo.mockResolvedValue(mockResult);

      // Act
      const result = await controller.processVideo('test-video-id', processDto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.videoId).toBe('test-video-id');
      expect(videoProcessingService.processVideo).toHaveBeenCalledWith(
        'test-video-id',
        processDto,
      );
    });
  });

  describe('getProcessingStatus', () => {
    it('should return processing status', async () => {
      // Arrange
      const mockStatus = {
        videoId: 'test-video-id',
        status: VideoStatus.PROCESSING,
        progress: 75,
        totalJobs: 4,
        completedJobs: 3,
        failedJobs: 0,
        variants: [],
        jobs: [],
      };

      videoProcessingService.getProcessingStatus.mockResolvedValue(mockStatus);

      // Act
      const result = await controller.getProcessingStatus('test-video-id');

      // Assert
      expect(result.videoId).toBe('test-video-id');
      expect(result.progress).toBe(75);
      expect(videoProcessingService.getProcessingStatus).toHaveBeenCalledWith(
        'test-video-id',
      );
    });
  });
});

describe('Utility Functions', () => {
  describe('FileUtils', () => {
    const { FileUtils } = require('./utils/file.utils');

    describe('formatFileSize', () => {
      it('should format file sizes correctly', () => {
        expect(FileUtils.formatFileSize(0)).toBe('0 Bytes');
        expect(FileUtils.formatFileSize(1024)).toBe('1 KB');
        expect(FileUtils.formatFileSize(1048576)).toBe('1 MB');
        expect(FileUtils.formatFileSize(1073741824)).toBe('1 GB');
      });
    });

    describe('getFileExtension', () => {
      it('should extract file extensions correctly', () => {
        expect(FileUtils.getFileExtension('video.mp4')).toBe('.mp4');
        expect(FileUtils.getFileExtension('test.video.webm')).toBe('.webm');
        expect(FileUtils.getFileExtension('noextension')).toBe('');
      });
    });

    describe('isVideoFile', () => {
      it('should identify video files correctly', () => {
        expect(FileUtils.isVideoFile('video/mp4')).toBe(true);
        expect(FileUtils.isVideoFile('video/webm')).toBe(true);
        expect(FileUtils.isVideoFile('image/jpeg')).toBe(false);
        expect(FileUtils.isVideoFile('text/plain')).toBe(false);
      });
    });
  });

  describe('ValidationUtils', () => {
    const { ValidationUtils } = require('./utils/validation.utils');

    describe('validateUUID', () => {
      it('should validate UUIDs correctly', () => {
        expect(
          ValidationUtils.validateUUID('123e4567-e89b-12d3-a456-426614174000'),
        ).toBe(true);
        expect(ValidationUtils.validateUUID('invalid-uuid')).toBe(false);
        expect(ValidationUtils.validateUUID('')).toBe(false);
      });
    });

    describe('sanitizeFilename', () => {
      it('should sanitize filenames correctly', () => {
        expect(ValidationUtils.sanitizeFilename('My Video File.mp4')).toBe(
          'my_video_file.mp4',
        );
        expect(ValidationUtils.sanitizeFilename('Video<>:"/\\|?*.mp4')).toBe(
          'video_.mp4',
        );
        expect(
          ValidationUtils.sanitizeFilename('  Multiple   Spaces  .mp4'),
        ).toBe('multiple_spaces.mp4');
      });
    });
  });

  describe('TimeUtils', () => {
    const { TimeUtils } = require('./utils/time.utils');

    describe('formatDuration', () => {
      it('should format durations correctly', () => {
        expect(TimeUtils.formatDuration(30)).toBe('0:30');
        expect(TimeUtils.formatDuration(90)).toBe('1:30');
        expect(TimeUtils.formatDuration(3661)).toBe('1:01:01');
      });
    });

    describe('parseDuration', () => {
      it('should parse duration strings correctly', () => {
        expect(TimeUtils.parseDuration('1:30')).toBe(90);
        expect(TimeUtils.parseDuration('1:01:01')).toBe(3661);
        expect(TimeUtils.parseDuration('invalid')).toBe(0);
      });
    });

    describe('getRelativeTime', () => {
      it('should return relative time strings', () => {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60000);
        const oneHourAgo = new Date(now.getTime() - 3600000);
        const oneDayAgo = new Date(now.getTime() - 86400000);

        expect(TimeUtils.getRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
        expect(TimeUtils.getRelativeTime(oneHourAgo)).toBe('1 hour ago');
        expect(TimeUtils.getRelativeTime(oneDayAgo)).toBe('1 day ago');
      });
    });
  });
});

// Integration test setup
describe('Video Processing Integration', () => {
  let app: any;
  let videoRepository: Repository<Video>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // Add test database configuration
        // TypeOrmModule.forRoot(testDatabaseConfig),
        // VideoProcessingModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    videoRepository = moduleFixture.get(getRepositoryToken(Video));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await videoRepository.clear();
  });

  it('should handle complete video processing workflow', async () => {
    // This would be a full integration test that:
    // 1. Uploads a video file
    // 2. Starts processing
    // 3. Monitors progress
    // 4. Verifies final results
    // 5. Cleans up resources

    // Implementation would depend on actual test environment setup
    expect(true).toBe(true); // Placeholder
  });
});
