import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as pdf from 'pdf-parse';
import { FileStorageService } from '../storage/file-storage.service';

export interface DocumentMetadata {
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  textContent?: string;
  wordCount?: number;
}

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    private configService: ConfigService,
    private fileStorageService: FileStorageService,
  ) {}

  async processPDF(fileBuffer: Buffer): Promise<DocumentMetadata> {
    try {
      const data = await pdf(fileBuffer);

      const metadata: DocumentMetadata = {
        pageCount: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate,
        modificationDate: data.info?.ModDate,
        textContent: data.text,
        wordCount: data.text ? data.text.split(/\s+/).length : 0,
      };

      this.logger.log(
        `Processed PDF: ${metadata.pageCount} pages, ${metadata.wordCount} words`,
      );
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to process PDF: ${error.message}`);
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  async extractTextFromDocument(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    try {
      switch (mimeType) {
        case 'application/pdf':
          const pdfData = await pdf(fileBuffer);
          return pdfData.text;

        case 'text/plain':
          return fileBuffer.toString('utf-8');

        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          // For Word documents, you'd need additional libraries like mammoth
          return this.extractTextFromWord(fileBuffer);

        default:
          throw new Error(`Unsupported document type: ${mimeType}`);
      }
    } catch (error) {
      this.logger.error(`Failed to extract text: ${error.message}`);
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }

  private async extractTextFromWord(fileBuffer: Buffer): Promise<string> {
    // Implementation would use libraries like mammoth for Word documents
    // For now, return empty string
    this.logger.warn('Word document text extraction not implemented');
    return '';
  }

  async generateDocumentPreview(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<Buffer | null> {
    try {
      if (mimeType === 'application/pdf') {
        // Generate PDF preview/thumbnail
        return this.generatePDFPreview(fileBuffer);
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to generate preview: ${error.message}`);
      return null;
    }
  }

  private async generatePDFPreview(fileBuffer: Buffer): Promise<Buffer | null> {
    // Implementation would use libraries like pdf2pic to generate image previews
    // For now, return null
    this.logger.warn('PDF preview generation not implemented');
    return null;
  }

  async validateDocument(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<boolean> {
    try {
      switch (mimeType) {
        case 'application/pdf':
          await pdf(fileBuffer);
          return true;

        case 'text/plain':
          // Basic validation for text files
          const text = fileBuffer.toString('utf-8');
          return text.length > 0;

        default:
          return true; // Basic validation passed
      }
    } catch (error) {
      this.logger.error(`Document validation failed: ${error.message}`);
      return false;
    }
  }

  async searchInDocument(
    fileBuffer: Buffer,
    mimeType: string,
    searchTerm: string,
  ): Promise<number> {
    try {
      const text = await this.extractTextFromDocument(fileBuffer, mimeType);
      const regex = new RegExp(searchTerm, 'gi');
      const matches = text.match(regex);
      return matches ? matches.length : 0;
    } catch (error) {
      this.logger.error(`Document search failed: ${error.message}`);
      return 0;
    }
  }
}
