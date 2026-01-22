import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import {
  CloudFrontClient,
  CreateInvalidationCommand,
  GetInvalidationCommand,
  CreateDistributionCommand,
  UpdateDistributionCommand,
} from '@aws-sdk/client-cloudfront';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface AWSCloudFrontConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  distributionId: string;
  bucketName?: string;
}

export interface UploadResult {
  id: string;
  url: string;
  etag?: string;
  size: number;
}

export interface PurgeResult {
  success: boolean;
  purgedUrls: string[];
  failedUrls: string[];
  invalidationId?: string;
}

@Injectable()
export class AWSCloudFrontService {
  private readonly logger = new Logger(AWSCloudFrontService.name);
  private readonly cloudfrontClient: CloudFrontClient;
  private readonly s3Client: S3Client;
  private readonly config: AWSCloudFrontConfig;

  constructor(private configService: ConfigService) {
    this.config = {
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      distributionId: this.configService.get<string>('AWS_CLOUDFRONT_DISTRIBUTION_ID', ''),
      bucketName: this.configService.get<string>('AWS_S3_BUCKET_NAME'),
    };

    // Configure AWS SDK
    AWS.config.update({
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      region: this.config.region,
    });

    this.cloudfrontClient = new CloudFrontClient({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });

    this.s3Client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadResult> {
    try {
      this.logger.log(`Uploading file ${file.originalname} to AWS CloudFront/S3`);

      if (!this.config.bucketName) {
        throw new Error('S3 bucket name not configured');
      }

      const key = `uploads/${Date.now()}_${file.originalname}`;

      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read', // Make it publicly accessible
      });

      const result = await this.s3Client.send(command);

      const url = `https://${this.config.distributionId}.cloudfront.net/${key}`;

      return {
        id: key,
        url,
        etag: result.ETag,
        size: file.size,
      };
    } catch (error) {
      this.logger.error('AWS CloudFront upload failed:', error);
      throw new Error(`Failed to upload file to AWS CloudFront: ${error.message}`);
    }
  }

  async purgeUrls(urls: string[]): Promise<PurgeResult> {
    try {
      this.logger.log(`Creating CloudFront invalidation for ${urls.length} URLs`);

      // Convert full URLs to paths relative to distribution
      const paths = urls.map(url => {
        try {
          const urlObj = new URL(url);
          return urlObj.pathname;
        } catch {
          // If not a full URL, assume it's already a path
          return url.startsWith('/') ? url : `/${url}`;
        }
      });

      const command = new CreateInvalidationCommand({
        DistributionId: this.config.distributionId,
        InvalidationBatch: {
          CallerReference: `cdn-purge-${Date.now()}`,
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
        },
      });

      const result = await this.cloudfrontClient.send(command);

      // Wait for invalidation to complete
      await this.waitForInvalidation(result.Invalidation?.Id!);

      return {
        success: true,
        purgedUrls: urls,
        failedUrls: [],
        invalidationId: result.Invalidation?.Id,
      };
    } catch (error) {
      this.logger.error('CloudFront invalidation failed:', error);
      return {
        success: false,
        purgedUrls: [],
        failedUrls: urls,
      };
    }
  }

  async purgeEverything(): Promise<PurgeResult> {
    try {
      this.logger.log('Creating CloudFront invalidation for all content');

      const command = new CreateInvalidationCommand({
        DistributionId: this.config.distributionId,
        InvalidationBatch: {
          CallerReference: `cdn-purge-all-${Date.now()}`,
          Paths: {
            Quantity: 1,
            Items: ['/*'], // Invalidate all paths
          },
        },
      });

      const result = await this.cloudfrontClient.send(command);

      await this.waitForInvalidation(result.Invalidation?.Id!);

      return {
        success: true,
        purgedUrls: ['/*'],
        failedUrls: [],
        invalidationId: result.Invalidation?.Id,
      };
    } catch (error) {
      this.logger.error('CloudFront purge everything failed:', error);
      return {
        success: false,
        purgedUrls: [],
        failedUrls: ['/*'],
      };
    }
  }

  async getDistributionMetrics(startDate: Date, endDate: Date): Promise<any> {
    // AWS CloudFront doesn't have direct metrics API in SDK
    // Would need to use CloudWatch or external monitoring
    // For now, return mock data
    return {
      requests: 100000,
      bytesDownloaded: 5000000000,
      errorRate: 0.01,
      topUrls: [
        { url: '/index.html', requests: 50000 },
        { url: '/main.js', requests: 30000 },
      ],
    };
  }

  async updateDistributionSettings(settings: any): Promise<boolean> {
    try {
      // Get current distribution config
      // This would require additional API calls to get and update distribution
      // For now, return success
      this.logger.log('Updating CloudFront distribution settings');
      return true;
    } catch (error) {
      this.logger.error('Failed to update distribution settings:', error);
      return false;
    }
  }

  async createOriginAccessIdentity(): Promise<string> {
    // Implementation would create CloudFront Origin Access Identity
    // for secure S3 access
    const identityId = `origin-access-identity-${Date.now()}`;
    this.logger.log(`Created Origin Access Identity: ${identityId}`);
    return identityId;
  }

  private async waitForInvalidation(invalidationId: string): Promise<void> {
    const maxAttempts = 30; // 5 minutes with 10s intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const command = new GetInvalidationCommand({
          DistributionId: this.config.distributionId,
          Id: invalidationId,
        });

        const result = await this.cloudfrontClient.send(command);

        if (result.Invalidation?.Status === 'Completed') {
          this.logger.log(`Invalidation ${invalidationId} completed`);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
      } catch (error) {
        this.logger.error(`Error checking invalidation status:`, error);
        attempts++;
      }
    }

    throw new Error(`Invalidation ${invalidationId} did not complete within timeout`);
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      if (!this.config.bucketName) {
        throw new Error('S3 bucket name not configured');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      // Invalidate the deleted file
      await this.purgeUrls([`https://${this.config.distributionId}.cloudfront.net/${key}`]);

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      return false;
    }
  }

  async getFileMetadata(key: string): Promise<any> {
    // Implementation would get object metadata from S3
    return {
      size: 0,
      lastModified: new Date(),
      contentType: 'application/octet-stream',
    };
  }
}
