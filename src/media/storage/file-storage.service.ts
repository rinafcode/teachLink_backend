import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { ContentMetadata } from '../../cdn/entities/content-metadata.entity';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET', '');

    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  // Legacy method for backward compatibility
  async uploadFile(
    file: Express.Multer.File,
    metadata: ContentMetadata,
  ): Promise<{ url: string; etag?: string }> {
    const key = `${metadata.contentId}/${Date.now()}_${file.originalname}`;
    await this.uploadProcessedFile(file.buffer, key, file.mimetype);
    return {
      url: `https://${this.bucketName}.s3.amazonaws.com/${key}`,
      etag: undefined,
    };
  }

  // Legacy method for backward compatibility
  async getSignedUrl(keyOrUrl: string, _expiresSec = 300): Promise<string> {
    // If a full URL is provided, return as-is
    if (keyOrUrl.startsWith('http')) return keyOrUrl;

    const _command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: keyOrUrl,
    });

    // For simplicity, return the key as URL (in production, generate proper signed URL)
    return `https://${this.bucketName}.s3.amazonaws.com/${keyOrUrl}`;
  }

  async uploadProcessedFile(buffer: Buffer, key: string, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    this.logger.log(`Uploaded file to ${key}`);
  }

  async downloadFile(storageKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async deleteFile(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    await this.s3Client.send(command);
    this.logger.log(`Deleted file ${storageKey}`);
  }
}
