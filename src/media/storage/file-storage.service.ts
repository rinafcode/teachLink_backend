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
import { IUploadedFile } from '../../common/types/file.types';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;
  private readonly region: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET', '') ||
      this.configService.get<string>('AWS_S3_BUCKET_NAME', '');

    const distributionId = this.configService.get<string>('AWS_CLOUDFRONT_DISTRIBUTION_ID', '');

    this.publicBaseUrl = distributionId
      ? `https://${distributionId}.cloudfront.net`
      : this.buildS3BaseUrl(this.bucketName, this.region);

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  // Legacy method for backward compatibility
  async uploadFile(
    file: IUploadedFile,
    metadata: ContentMetadata,
  ): Promise<{ url: string; etag?: string }> {
    const key = `${metadata.contentId}/${Date.now()}_${file.originalname}`;
    const etag = await this.uploadProcessedFile(file.buffer, key, file.mimetype);
    return {
      url: this.getPublicUrl(key),
      etag,
    };
  }

  // Legacy method for backward compatibility
  async getSignedUrl(keyOrUrl: string, _expiresInSeconds = 900): Promise<string> {
    // If a full URL is provided, return as-is
    if (keyOrUrl.startsWith('http')) return keyOrUrl;

    return this.getPublicUrl(keyOrUrl);
  }

  async uploadProcessedFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string | undefined> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    const result = await this.s3Client.send(command);
    this.logger.log(`Uploaded file to ${key}`);
    return result.ETag;
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

  getPublicUrl(storageKey: string): string {
    if (!storageKey) return '';
    if (!this.publicBaseUrl) return storageKey;
    return `${this.publicBaseUrl.replace(/\/+$/, '')}/${storageKey.replace(/^\/+/, '')}`;
  }

  private buildS3BaseUrl(bucketName: string, region: string): string {
    if (!bucketName) return '';
    if (!region || region === 'us-east-1') {
      return `https://${bucketName}.s3.amazonaws.com`;
    }
    return `https://${bucketName}.s3.${region}.amazonaws.com`;
  }
}
