import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentMetadata]),
    BullModule.registerQueue({ name: 'media-processing' }),
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
