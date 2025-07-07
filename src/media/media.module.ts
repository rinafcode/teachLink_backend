import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { Media } from './entities/media.entity';
import { FileStorageService } from './storage/file-storage.service';
import { VideoProcessingService } from './processing/video-processing.service';
import { DocumentProcessingService } from './processing/document-processing.service';

@Module({
  imports: [TypeOrmModule.forFeature([Media]), ConfigModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    FileStorageService,
    VideoProcessingService,
    DocumentProcessingService,
  ],
  exports: [
    MediaService,
    FileStorageService,
    VideoProcessingService,
    DocumentProcessingService,
  ],
})
export class MediaModule {}
