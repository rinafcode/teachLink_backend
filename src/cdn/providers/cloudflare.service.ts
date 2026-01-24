import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface CloudflareConfig {
  apiToken: string;
  accountId: string;
  zoneId: string;
  baseUrl?: string;
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
}

@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly httpClient: AxiosInstance;
  private readonly config: CloudflareConfig;

  constructor(private configService: ConfigService) {
    this.config = {
      apiToken: this.configService.get<string>('CLOUDFLARE_API_TOKEN', ''),
      accountId: this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID', ''),
      zoneId: this.configService.get<string>('CLOUDFLARE_ZONE_ID', ''),
      baseUrl: 'https://api.cloudflare.com/client/v4',
    };

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadResult> {
    try {
      this.logger.log(`Uploading file ${file.originalname} to Cloudflare`);

      // For images, use Cloudflare Images API
      if (file.mimetype.startsWith('image/')) {
        return this.uploadImage(file);
      }

      // For other files, use R2 or Stream
      return this.uploadToR2(file);
    } catch (error) {
      this.logger.error('Cloudflare upload failed:', error);
      throw new Error(`Failed to upload file to Cloudflare: ${error.message}`);
    }
  }

  async purgeUrls(urls: string[]): Promise<PurgeResult> {
    try {
      this.logger.log(`Purging ${urls.length} URLs from Cloudflare`);

      const response = await this.httpClient.post(
        `/zones/${this.config.zoneId}/purge_cache`,
        {
          files: urls,
        },
      );

      if (response.data.success) {
        return {
          success: true,
          purgedUrls: urls,
          failedUrls: [],
        };
      } else {
        this.logger.error('Cloudflare purge failed:', response.data.errors);
        return {
          success: false,
          purgedUrls: [],
          failedUrls: urls,
        };
      }
    } catch (error) {
      this.logger.error('Cloudflare purge error:', error);
      return {
        success: false,
        purgedUrls: [],
        failedUrls: urls,
      };
    }
  }

  async purgeEverything(): Promise<boolean> {
    try {
      const response = await this.httpClient.post(
        `/zones/${this.config.zoneId}/purge_cache`,
        {
          purge_everything: true,
        },
      );

      return response.data.success;
    } catch (error) {
      this.logger.error('Cloudflare purge everything failed:', error);
      return false;
    }
  }

  async getAnalytics(startDate: Date, endDate: Date): Promise<any> {
    try {
      const response = await this.httpClient.get(
        `/zones/${this.config.zoneId}/analytics/dashboard`,
        {
          params: {
            since: startDate.toISOString(),
            until: endDate.toISOString(),
          },
        },
      );

      return response.data.result;
    } catch (error) {
      this.logger.error('Failed to get Cloudflare analytics:', error);
      return null;
    }
  }

  async createCustomDomain(domain: string): Promise<boolean> {
    try {
      const response = await this.httpClient.post(
        `/zones/${this.config.zoneId}/custom_certificates`,
        {
          certificate: '', // Would need actual certificate
          private_key: '', // Would need actual private key
          bundle_method: 'ubiquitous',
        },
      );

      return response.data.success;
    } catch (error) {
      this.logger.error(`Failed to create custom domain ${domain}:`, error);
      return false;
    }
  }

  async getZoneSettings(): Promise<any> {
    try {
      const response = await this.httpClient.get(
        `/zones/${this.config.zoneId}/settings`,
      );

      return response.data.result;
    } catch (error) {
      this.logger.error('Failed to get zone settings:', error);
      return null;
    }
  }

  async updateCacheSettings(settings: any): Promise<boolean> {
    try {
      const response = await this.httpClient.patch(
        `/zones/${this.config.zoneId}/settings/cache_level`,
        {
          value: settings.cacheLevel || 'aggressive',
        },
      );

      return response.data.success;
    } catch (error) {
      this.logger.error('Failed to update cache settings:', error);
      return false;
    }
  }

  private async uploadImage(file: Express.Multer.File): Promise<UploadResult> {
    // Use Cloudflare Images API
    // In real implementation, would use proper multipart/form-data
    // For now, return mock result
    const mockId = `cf_img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: mockId,
      url: `https://imagedelivery.net/${mockId}/${file.originalname}`,
      size: file.size,
    };
  }

  private async uploadToR2(file: Express.Multer.File): Promise<UploadResult> {
    // Use Cloudflare R2 for non-image files
    // This would require R2 bucket configuration
    // For now, return mock result
    const mockId = `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: mockId,
      url: `https://r2.example.com/${mockId}/${file.originalname}`,
      size: file.size,
    };
  }

  async getImageVariants(imageId: string): Promise<string[]> {
    try {
      const response = await this.httpClient.get(
        `/accounts/${this.config.accountId}/images/v1/${imageId}/variants`,
      );

      return response.data.result?.variants || [];
    } catch (error) {
      this.logger.error(`Failed to get variants for image ${imageId}:`, error);
      return [];
    }
  }

  async deleteImage(imageId: string): Promise<boolean> {
    try {
      const response = await this.httpClient.delete(
        `/accounts/${this.config.accountId}/images/v1/${imageId}`,
      );

      return response.data.success;
    } catch (error) {
      this.logger.error(`Failed to delete image ${imageId}:`, error);
      return false;
    }
  }
}
