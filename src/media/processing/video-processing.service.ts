import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { ContentMetadata } from '../../cdn/entities/content-metadata.entity';

/**
 * Provides video Processing operations.
 */
@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  constructor(@InjectQueue(QUEUE_NAMES.MEDIA_PROCESSING) private readonly queue: Queue) {}

  /**
   * Executes enqueue Transcode.
   * @param content The content.
   * @returns The operation result.
   */
  async enqueueTranscode(content: ContentMetadata) {
    await this.queue.add(
      JOB_NAMES.TRANSCODE_VIDEO,
      {
        contentId: content.contentId,
        url: content.cdnUrl,
        fileName: content.fileName,
        mimeType: content.mimeType,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    this.logger.log(`Job enqueued for content ${content.contentId}`);
  }
}
