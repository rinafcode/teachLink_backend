import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentMetadata, ContentStatus, ContentType } from '../cdn/entities/content-metadata.entity';
import { FileStorageService } from './storage/file-storage.service';
import { VideoProcessingService } from './processing/video-processing.service';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(ContentMetadata)
    private readonly contentRepo: Repository<ContentMetadata>,
    private readonly storage: FileStorageService,
    private readonly videoProcessing: VideoProcessingService,
  ) {}

  async createFromUpload(ownerId: string, tenantId: string | undefined, file: Express.Multer.File) {
    // Create metadata entity in UPLOADING state
    const content = this.contentRepo.create({
      contentId: `media_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      originalUrl: '',
      cdnUrl: '',
      contentType: this.mapContentType(file.mimetype),
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      status: ContentStatus.UPLOADING,
      provider: 'media',
      metadata: {},
      ownerId,
      tenantId,
    } as Partial<ContentMetadata>);

    await this.contentRepo.save(content);

    // Store file using storage service
    const upload = await this.storage.uploadFile(file, content);

    content.originalUrl = upload.url;
    content.cdnUrl = upload.url;
    content.etag = upload.etag;
    content.status = ContentStatus.READY;
    await this.contentRepo.save(content);

    // If video, enqueue processing
    if (content.contentType === ContentType.VIDEO) {
      this.logger.log(`Enqueue video processing for ${content.contentId}`);
      await this.videoProcessing.enqueueTranscode(content);
      content.status = ContentStatus.PROCESSING;
      await this.contentRepo.save(content);
    }

    return content;
  }

  async findByContentId(contentId: string) {
    return this.contentRepo.findOne({ where: { contentId } });
  }

  private mapContentType(mime: string) {
    if (mime.startsWith('image/')) return ContentType.IMAGE;
    if (mime.startsWith('video/')) return ContentType.VIDEO;
    return ContentType.DOCUMENT;
  }
}
