import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContentMetadata,
  ContentStatus,
  ContentType,
} from '../cdn/entities/content-metadata.entity';
import { FileStorageService } from './storage/file-storage.service';
import { VideoProcessingService } from './processing/video-processing.service';
import { UploadedFile } from '@nestjs/common';
import { FileValidationService } from './validation/file-validation.service';
import { MalwareScanningService } from './validation/malware-scanning.service';
import { ImageProcessingService } from './processing/image-processing.service';
import { UploadProgressService } from './validation/upload-progress.service';
import { v4 as uuidv4 } from 'uuid';

export interface IUploadOptions {
  compress?: boolean;
  generateThumbnails?: boolean;
  scanForMalware?: boolean;
  trackProgress?: boolean;
  expiresIn?: number; // TTL in seconds
}

export interface IUploadResult {
  content: ContentMetadata;
  thumbnails?: Array<{ name: string; url: string }>;
  compressionRatio?: number;
  scanResult?: { clean: boolean; threats: string[] };
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(ContentMetadata)
    private readonly contentRepo: Repository<ContentMetadata>,
    private readonly storage: FileStorageService,
    private readonly videoProcessing: VideoProcessingService,
    private readonly fileValidation: FileValidationService,
    private readonly malwareScanning: MalwareScanningService,
    private readonly imageProcessing: ImageProcessingService,
    private readonly uploadProgress: UploadProgressService,
  ) {}

  async createFromUpload(
    ownerId: string,
    tenantId: string | undefined,
    file: UploadedFile,
    options: IUploadOptions = {},
  ): Promise<IUploadResult> {
    const uploadId = uuidv4();
    const result: IUploadResult = { content: null as unknown as ContentMetadata };

    try {
      // Initialize progress tracking if enabled
      if (options.trackProgress !== false) {
        await this.uploadProgress.initializeUpload(uploadId, file.originalname, file.size);
      }

      // Step 1: Validate file
      if (options.trackProgress !== false) {
        await this.uploadProgress.updateProgress(uploadId, {
          status: 'validating',
          progress: 10,
          stage: 'validation',
          message: 'Validating file...',
        });
      }

      const validationResult = await this.fileValidation.validateFile(file);
      if (!validationResult.valid) {
        if (options.trackProgress !== false) {
          await this.uploadProgress.markFailed(uploadId, validationResult.errors.join(', '));
        }
        throw new BadRequestException({
          message: 'File validation failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });
      }

      // Step 2: Malware scanning
      if (options.scanForMalware !== false) {
        if (!this.malwareScanning.isScanningAvailable()) {
          const errorMsg =
            'Malware scanning is required for uploads but no scanning service is available';

          if (options.trackProgress !== false) {
            await this.uploadProgress.markFailed(uploadId, errorMsg);
          }

          throw new ServiceUnavailableException(errorMsg);
        }

        if (options.trackProgress !== false) {
          await this.uploadProgress.updateProgress(uploadId, {
            status: 'scanning',
            progress: 25,
            stage: 'malware-scan',
            message: 'Scanning for malware...',
          });
        }

        const scanResult = await this.malwareScanning.scanFile(file);
        result.scanResult = {
          clean: scanResult.clean,
          threats: scanResult.threats,
        };

        if (!scanResult.clean) {
          const detectedThreats = scanResult.threats.filter(Boolean);
          const errorMsg =
            detectedThreats.length > 0
              ? `Malware detected: ${detectedThreats.join(', ')}`
              : scanResult.error || 'File failed security scan';

          if (options.trackProgress !== false) {
            await this.uploadProgress.markFailed(uploadId, errorMsg);
          }

          if (detectedThreats.length > 0) {
            throw new ForbiddenException(errorMsg);
          }

          throw new ServiceUnavailableException(errorMsg);
        }
      }

      // Create metadata entity
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
        metadata: validationResult.metadata || {},
        ownerId,
        tenantId,
      } as Partial<ContentMetadata>);

      await this.contentRepo.save(content);
      result.content = content;

      // Step 3: Process image (compression & thumbnails)
      let processedFile = file;
      if (content.contentType === ContentType.IMAGE && options.compress !== false) {
        if (options.trackProgress !== false) {
          await this.uploadProgress.updateProgress(uploadId, {
            status: 'processing',
            progress: 40,
            stage: 'image-processing',
            message: 'Optimizing image...',
          });
        }

        try {
          const compressed = await this.imageProcessing.compressImage(file.buffer);
          processedFile = {
            ...file,
            buffer: compressed.buffer,
            size: compressed.size,
          };
          result.compressionRatio = compressed.compressionRatio;
          content.optimizedSize = compressed.size;

          // Update metadata with dimensions
          if (compressed.width && compressed.height) {
            content.metadata = {
              ...content.metadata,
              width: compressed.width,
              height: compressed.height,
            };
          }

          // Generate thumbnails
          if (options.generateThumbnails !== false) {
            if (options.trackProgress !== false) {
              await this.uploadProgress.updateProgress(uploadId, {
                progress: 60,
                stage: 'thumbnail-generation',
                message: 'Generating thumbnails...',
              });
            }

            const thumbnails = await this.imageProcessing.generateThumbnails(file.buffer);
            result.thumbnails = [];

            for (const thumb of thumbnails) {
              const thumbKey = `${content.contentId}/thumbnails/${thumb.name}.webp`;
              await this.storage.uploadProcessedFile(thumb.buffer, thumbKey, 'image/webp');
              result.thumbnails.push({
                name: thumb.name,
                url: `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${thumbKey}`,
              });
            }

            // Store thumbnail URLs in variants
            content.variants = result.thumbnails.map((t) => ({
              name: t.name,
              url: t.url,
              width: 0, // Will be populated from thumbnail data
              height: 0,
              size: 0,
            }));
          }
        } catch (error) {
          this.logger.warn('Image processing failed, using original:', error);
        }
      }

      // Step 4: Upload to storage
      if (options.trackProgress !== false) {
        await this.uploadProgress.updateProgress(uploadId, {
          status: 'uploading',
          progress: 80,
          stage: 'storage-upload',
          message: 'Uploading to storage...',
        });
      }

      const upload = await this.storage.uploadFile(processedFile, content);

      content.originalUrl = upload.url;
      content.cdnUrl = upload.url;
      content.etag = upload.etag;
      content.status = ContentStatus.READY;

      if (options.expiresIn) {
        content.expiresAt = new Date(Date.now() + options.expiresIn * 1000);
      }

      await this.contentRepo.save(content);

      // Step 5: Video processing (if applicable)
      if (content.contentType === ContentType.VIDEO) {
        this.logger.log(`Enqueue video processing for ${content.contentId}`);
        await this.videoProcessing.enqueueTranscode(content);
        content.status = ContentStatus.PROCESSING;
        await this.contentRepo.save(content);
      }

      // Mark as completed
      if (options.trackProgress !== false) {
        await this.uploadProgress.markCompleted(uploadId, {
          contentId: content.contentId,
          url: content.cdnUrl,
          thumbnails: result.thumbnails?.map((t) => t.url),
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Upload failed:', error);

      if (options.trackProgress !== false) {
        await this.uploadProgress.markFailed(
          uploadId,
          error instanceof Error ? error.message : 'Unknown error',
        );
      }

      throw error;
    }
  }

  async deleteMedia(contentId: string): Promise<void> {
    const content = await this.findByContentId(contentId);
    if (!content) {
      throw new BadRequestException('Content not found');
    }

    // Delete from storage
    if (content.originalUrl) {
      const key = this.extractKeyFromUrl(content.originalUrl);
      if (key) await this.storage.deleteFile(key);
    }

    // Delete thumbnails/variants
    if (content.variants && content.variants.length > 0) {
      for (const variant of content.variants) {
        const key = this.extractKeyFromUrl(variant.url);
        if (key) await this.storage.deleteFile(key);
      }
    }

    // Delete from database
    await this.contentRepo.delete({ contentId });
    this.logger.log(`Deleted media and metadata for ${contentId}`);
  }

  async cleanupExpiredFiles(): Promise<number> {
    const expired = await this.contentRepo
      .createQueryBuilder('content')
      .where('content.expiresAt IS NOT NULL')
      .andWhere('content.expiresAt < :now', { now: new Date() })
      .getMany();

    if (expired.length === 0) return 0;

    this.logger.log(`Cleaning up ${expired.length} expired files`);

    for (const content of expired) {
      try {
        await this.deleteMedia(content.contentId);
      } catch (error) {
        this.logger.error(`Failed to cleanup expired file ${content.contentId}`, error);
      }
    }

    return expired.length;
  }

  async getStorageUsage(): Promise<{ totalSize: number; fileCount: number }> {
    const result = await this.contentRepo
      .createQueryBuilder('content')
      .select('SUM(content.fileSize)', 'totalSize')
      .addSelect('COUNT(content.id)', 'fileCount')
      .getRawOne();

    return {
      totalSize: parseInt(result.totalSize || '0', 10),
      fileCount: parseInt(result.fileCount || '0', 10),
    };
  }

  async bulkDeleteMedia(contentIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [], failed: [] };

    for (const contentId of contentIds) {
      try {
        await this.deleteMedia(contentId);
        results.success.push(contentId);
      } catch (error) {
        this.logger.error(`Failed to delete media ${contentId} in bulk`, error);
        results.failed.push(contentId);
      }
    }

    return results;
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      const parts = url.split('.s3.amazonaws.com/');
      return parts.length > 1 ? parts[1] : null;
    } catch {
      return null;
    }
  }

  async findByContentId(contentId: string) {
    return this.contentRepo.findOne({ where: { contentId } });
  }

  /**
   * Get upload progress
   */
  async getUploadProgress(uploadId: string) {
    return this.uploadProgress.getProgress(uploadId);
  }

  /**
   * List active uploads
   */
  async listActiveUploads() {
    return this.uploadProgress.listActiveUploads();
  }

  /**
   * Get upload statistics
   */
  async getUploadStatistics() {
    return this.uploadProgress.getStatistics();
  }

  private mapContentType(mime: string) {
    if (mime.startsWith('image/')) return ContentType.IMAGE;
    if (mime.startsWith('video/')) return ContentType.VIDEO;
    if (mime.startsWith('audio/')) return ContentType.AUDIO;
    return ContentType.DOCUMENT;
  }
}
