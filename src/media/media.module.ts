import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { FileStorageService } from './storage/file-storage.service';
import { VideoProcessingService } from './processing/video-processing.service';
import { DocumentProcessingService } from './processing/document-processing.service';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    FileStorageService,
    VideoProcessingService,
    DocumentProcessingService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
