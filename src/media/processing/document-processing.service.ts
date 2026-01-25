import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  async process(filePath: string) {
    // TODO: Implement PDF parsing and metadata extraction
    this.logger.log(
      `Document processing queued (stub): ${filePath}`,
    );
  }
}
