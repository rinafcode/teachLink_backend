import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { FileStorageService } from './storage/file-storage.service';
import { VideoProcessingService } from './processing/video-processing.service';
import { DocumentProcessingService } from './processing/document-processing.service';
import { ImageProcessingService } from './processing/image-processing.service';
import { FileValidationService } from './validation/file-validation.service';
import { MalwareScanningService } from './validation/malware-scanning.service';
import { UploadProgressService } from './validation/upload-progress.service';
import { ContentMetadata } from '../cdn/entities/content-metadata.entity';
import { VideoProcessor } from './processing/video.processor';
import { FileCleanupTask } from './file-cleanup.task';

/**
 * Registers the media module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ContentMetadata]),
    BullModule.registerQueue({ name: QUEUE_NAMES.MEDIA_PROCESSING }),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    FileStorageService,
    VideoProcessingService,
    DocumentProcessingService,
    ImageProcessingService,
    FileValidationService,
    MalwareScanningService,
    UploadProgressService,
    // processors
    VideoProcessor,
    FileCleanupTask,
  ],
  exports: [
    MediaService,
    FileStorageService,
    VideoProcessingService,
    FileValidationService,
    ImageProcessingService,
  ],
})
export class MediaModule {}
