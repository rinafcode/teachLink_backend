import { Injectable } from '@nestjs/common';
import { FileStorageService } from './storage/file-storage.service';
import { VideoProcessingService } from './processing/video-processing.service';
import { DocumentProcessingService } from './processing/document-processing.service';

@Injectable()
export class MediaService {
  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly videoProcessingService: VideoProcessingService,
    private readonly documentProcessingService: DocumentProcessingService,
  ) {}

  async handleUpload(file: Express.Multer.File) {
    const storedFile = await this.fileStorageService.store(file);

    if (file.mimetype.startsWith('video/')) {
      await this.videoProcessingService.process(storedFile.path);
    }

    if (file.mimetype === 'application/pdf') {
      await this.documentProcessingService.process(storedFile.path);
    }

    return {
      message: 'File uploaded successfully',
      file: {
        filename: storedFile.filename,
        path: storedFile.path,
        size: file.size,
        mimeType: file.mimetype,
      },
    };
  }
}
