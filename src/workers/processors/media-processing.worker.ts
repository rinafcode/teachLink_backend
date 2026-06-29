import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { BaseWorker } from '../base/base.worker';
import { fileTypeFromBuffer } from 'file-type';
import {
  FILE_SIZE_LIMITS,
  ALL_ALLOWED_FILE_TYPES,
} from '../../media/validation/file-validation.constants';

/**
 * Media Processing Worker
 * Handles image optimization, video transcoding, and file processing
 */
@Injectable()
export class MediaProcessingWorker extends BaseWorker {
  constructor() {
    super('media-processing');
  }

  /**
   * Execute media processing job
   */
  async execute(job: Job): Promise<any> {
    const { mediaType, fileUrl, format, options, fileBuffer, declaredMimeType } = job.data;

    await job.progress(20);

    // Validate media data
    if (!fileUrl || !mediaType) {
      throw new Error('Missing required media fields: fileUrl, mediaType');
    }

    // Validate file size if buffer is provided
    if (fileBuffer && Buffer.isBuffer(fileBuffer)) {
      const maxSize = this.getMaxSizeForType(mediaType);
      if (fileBuffer.length > maxSize) {
        this.logger.error(
          `File size ${fileBuffer.length} exceeds limit ${maxSize} for type ${mediaType}`,
        );
        throw new Error(
          `File size ${Math.round(fileBuffer.length / 1024 / 1024)}MB exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB for ${mediaType}`,
        );
      }

      // Validate MIME type using magic bytes
      if (fileBuffer.length >= 4) {
        const detectedType = await fileTypeFromBuffer(fileBuffer);

        if (!detectedType) {
          throw new Error('Could not determine file type from content. File may be corrupted or format not supported.');
        }

        const detectedMimeType = detectedType.mime.toLowerCase();
        // Check if detected MIME type is in allowed list
        if (!ALL_ALLOWED_FILE_TYPES.includes(detectedMimeType)) {
          throw new Error(
            `Detected file type "${detectedMimeType}" is not allowed. Allowed types: ${ALL_ALLOWED_FILE_TYPES.join(', ')}`,
          );
        }

        // Compare declared vs detected MIME type if declared
        if (declaredMimeType) {
          const declared = declaredMimeType.toLowerCase();
          if (declared !== detectedMimeType) {
            this.logger.warn(
              `MIME type mismatch: declared="${declared}", detected="${detectedMimeType}"`,
            );
            throw new Error(
              `Declared MIME type "${declared}" does not match actual file content "${detectedMimeType}"`,
            );
          }
        }

        // Validate that detected type matches expected media type category
        const expectedCategory = mediaType.toLowerCase();
        const detectedCategory = detectedMimeType.split('/')[0];
        if (expectedCategory !== detectedCategory) {
          throw new Error(
            `Expected ${expectedCategory} file but detected ${detectedCategory} (${detectedMimeType})`,
          );
        }

        this.logger.log(
          `File validation passed: ${fileUrl}, size: ${fileBuffer.length}, type: ${detectedMimeType}`,
        );
      }
    }

    await job.progress(40);

    try {
      this.logger.log(`Processing ${mediaType} from ${fileUrl}`);

      // Route to appropriate processor
      let result;
      switch (mediaType.toLowerCase()) {
        case 'image':
          result = await this.processImage(job, fileUrl, format, options);
          break;
        case 'video':
          result = await this.processVideo(job, fileUrl, format, options);
          break;
        case 'audio':
          result = await this.processAudio(job, fileUrl, format, options);
          break;
        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      await job.progress(100);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process media ${fileUrl}:`, error);
      throw error;
    }
  }

  /**
   * Get maximum file size for a given media type
   */
  private getMaxSizeForType(mediaType: string): number {
    const type = mediaType.toLowerCase();

    if (type === 'image') {
      return FILE_SIZE_LIMITS.IMAGE_MAX_SIZE;
    }
    if (type === 'video') {
      return FILE_SIZE_LIMITS.VIDEO_MAX_SIZE;
    }
    if (type === 'audio') {
      return FILE_SIZE_LIMITS.AUDIO_MAX_SIZE;
    }
    if (type === 'document') {
      return FILE_SIZE_LIMITS.DOCUMENT_MAX_SIZE;
    }

    return FILE_SIZE_LIMITS.DEFAULT_MAX_SIZE;
  }

  /**
   * Process image file
   */
  private async processImage(
    job: Job,
    fileUrl: string,
    format: string,
    _options: any,
  ): Promise<any> {
    await job.progress(50);
    this.logger.log(`Processing image: ${fileUrl}, format: ${format || 'original'}`);

    // Simulate image processing (resize, optimize, etc.)
    await new Promise((resolve) => setTimeout(resolve, 200));

    await job.progress(80);

    return {
      mediaType: 'image',
      originalUrl: fileUrl,
      format: format || 'jpeg',
      optimized: true,
      processingTime: Date.now(),
      status: 'completed',
    };
  }

  /**
   * Process video file
   */
  private async processVideo(
    job: Job,
    fileUrl: string,
    format: string,
    _options: any,
  ): Promise<any> {
    await job.progress(50);
    this.logger.log(`Processing video: ${fileUrl}, format: ${format || 'mp4'}`);

    // Simulate video transcoding (would use FFmpeg in production)
    await new Promise((resolve) => setTimeout(resolve, 500));

    await job.progress(85);

    return {
      mediaType: 'video',
      originalUrl: fileUrl,
      format: format || 'mp4',
      transcoded: true,
      processingTime: Date.now(),
      status: 'completed',
    };
  }

  /**
   * Process audio file
   */
  private async processAudio(
    job: Job,
    fileUrl: string,
    format: string,
    _options: any,
  ): Promise<any> {
    await job.progress(50);
    this.logger.log(`Processing audio: ${fileUrl}, format: ${format || 'mp3'}`);

    // Simulate audio processing
    await new Promise((resolve) => setTimeout(resolve, 150));

    await job.progress(85);

    return {
      mediaType: 'audio',
      originalUrl: fileUrl,
      format: format || 'mp3',
      processed: true,
      processingTime: Date.now(),
      status: 'completed',
    };
  }
}
