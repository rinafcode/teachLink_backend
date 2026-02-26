import { Injectable, Logger } from '@nestjs/common';
import { ContentMetadata } from '../../cdn/entities/content-metadata.entity';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly bucket = process.env.MEDIA_BUCKET || process.env.AWS_S3_BUCKET || 'teachlink-media';

  async uploadFile(file: Express.Multer.File, metadata: ContentMetadata): Promise<{ url: string; etag?: string }>
  {
    const key = `${metadata.contentId}/${Date.now()}_${file.originalname}`;

    const params: AWS.S3.PutObjectRequest = {
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalname: file.originalname,
        ownerId: metadata.ownerId || '',
        tenantId: metadata.tenantId || '',
      },
    };

    const res = await s3.upload(params).promise();
    this.logger.log(`Uploaded ${key} to S3 ${res.Location}`);

    return { url: res.Location, etag: (res as any).ETag };
  }

  async getSignedUrl(keyOrUrl: string, expiresSec = 300): Promise<string> {
    // If a full URL is provided, return as-is
    if (keyOrUrl.startsWith('http')) return keyOrUrl;

    const params = { Bucket: this.bucket, Key: keyOrUrl, Expires: expiresSec } as any;
    return s3.getSignedUrlPromise('getObject', params);
  }

  async backupToBucket(key: string, backupBucket: string): Promise<void> {
    await s3.copyObject({
      Bucket: backupBucket,
      CopySource: `${this.bucket}/${key}`,
      Key: key,
    }).promise();
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

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
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
          '',
        ),
      },
    });
  }

  async uploadProcessedFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<void> {
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
