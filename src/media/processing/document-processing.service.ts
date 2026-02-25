import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentMetadata } from '../../cdn/entities/content-metadata.entity';
import { FileStorageService } from '../storage/file-storage.service';

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    private readonly storage: FileStorageService,
    @InjectRepository(ContentMetadata)
    private readonly contentRepo: Repository<ContentMetadata>,
  ) {}

  async parsePdfFromContent(contentId: string) {
    const meta = await this.contentRepo.findOne({ where: { contentId } });
    if (!meta) return null;

    const signed = await this.storage.getSignedUrl(meta.cdnUrl, 60);
    const buffer = await downloadToBuffer(signed);

    try {
      const parsed = await pdfParse(buffer);
      meta.metadata = meta.metadata || {};
      meta.metadata.text = parsed.text;
      await this.contentRepo.save(meta);
      return parsed.text;
    } catch (err) {
      this.logger.error('PDF parsing failed', err);
      throw err;
    }
  }
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const https = url.startsWith('https') ? await import('https') : await import('http');
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res: any) => {
      if (res.statusCode >= 400) return reject(new Error(`Failed to download: ${res.statusCode}`));
      const data: Buffer[] = [];
      res.on('data', (chunk: Buffer) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    });
    req.on('error', (err: Error) => reject(err));
  });
}
