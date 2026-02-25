import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ContentMetadata } from '../../cdn/entities/content-metadata.entity';

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  constructor(@InjectQueue('media-processing') private readonly queue: Queue) {}

  async enqueueTranscode(content: ContentMetadata) {
    await this.queue.add('transcode-video', {
      contentId: content.contentId,
      url: content.cdnUrl,
      fileName: content.fileName,
      mimeType: content.mimeType,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    this.logger.log(`Job enqueued for content ${content.contentId}`);
  }
}
