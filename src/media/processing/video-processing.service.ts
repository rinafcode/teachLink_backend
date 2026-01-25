import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  async process(filePath: string) {
    // TODO: Implement video transcoding using a queue (Bull + Redis)
    this.logger.log(
      `Video processing queued (stub): ${filePath}`,
    );
  }
}
