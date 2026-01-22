import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';
import { AssetOptimizationService } from './optimization/asset-optimization.service';
import { EdgeCachingService } from './caching/edge-caching.service';
import { GeoLocationService } from './geo/geo-location.service';
import { CloudflareService } from './providers/cloudflare.service';
import { AWSCloudFrontService } from './providers/aws-cloudfront.service';
import { ContentMetadata, ContentType, ContentStatus } from './entities/content-metadata.entity';

export interface ContentDeliveryOptions {
  optimize?: boolean;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  width?: number;
  height?: number;
  userLocation?: string;
  bandwidth?: number;
  responsive?: boolean;
}

@Injectable()
export class CdnService {
  private readonly logger = new Logger(CdnService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(ContentMetadata)
    private contentMetadataRepository: Repository<ContentMetadata>,
    private assetOptimizationService: AssetOptimizationService,
    private edgeCachingService: EdgeCachingService,
    private geoLocationService: GeoLocationService,
    private cloudflareService: CloudflareService,
  ) {}

  async deliverContent(
    contentId: string,
    options: ContentDeliveryOptions = {},
  ): Promise<string> {
    const cacheKey = `cdn:${contentId}:${JSON.stringify(options)}`;

    // Check cache first
    const cachedUrl = await this.cacheManager.get<string>(cacheKey);
    if (cachedUrl) {
      return cachedUrl;
    }

    // Get content metadata
    const metadata = await this.getContentMetadata(contentId);
    if (!metadata) {
      throw new Error(`Content not found: ${contentId}`);
    }

    // Update access statistics
    await this.updateAccessStats(metadata);

    // Determine optimal delivery strategy
    const optimalLocation = await this.geoLocationService.getOptimalLocation(
      options.userLocation,
    );

    // Optimize content if needed
    let deliveryUrl = metadata.cdnUrl || metadata.originalUrl;
    if (options.optimize && metadata.contentType === ContentType.IMAGE) {
      deliveryUrl = await this.assetOptimizationService.optimizeImage(
        deliveryUrl,
        options,
      );
    }

    // Apply bandwidth optimization
    if (options.bandwidth) {
      deliveryUrl = await this.optimizeForBandwidth(deliveryUrl, options.bandwidth);
    }

    // Get edge-cached URL
    const edgeUrl = await this.edgeCachingService.getEdgeUrl(
      deliveryUrl,
      optimalLocation,
    );

    // Cache the result
    await this.cacheManager.set(cacheKey, edgeUrl, 3600000); // 1 hour

    return edgeUrl;
  }

  async invalidateContent(contentId: string): Promise<void> {
    // Purge from edge caches
    await this.edgeCachingService.purgeContent(contentId);

    // Clear local cache - simplified approach
    // In a real implementation, you might need to track cache keys separately
    // or use a cache store that supports key pattern deletion
    this.logger.warn(`Cache invalidation for ${contentId} - manual cleanup may be required`);
  }

  async uploadContent(
    file: Express.Multer.File,
    options: ContentDeliveryOptions = {},
  ): Promise<ContentMetadata> {
    try {
      // Upload to primary CDN provider with failover
      const uploadResult = await this.uploadWithFailover(file);

      // Create metadata entity
      const contentId = this.generateContentId();
      const metadata = this.contentMetadataRepository.create({
        contentId,
        originalUrl: uploadResult.url,
        cdnUrl: uploadResult.url,
        contentType: this.mapContentType(file.mimetype),
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: ContentStatus.READY,
        etag: uploadResult.etag,
        provider: uploadResult.provider,
        optimizationSettings: options.optimize ? {
          width: options.width,
          height: options.height,
          quality: options.quality,
          format: options.format,
          responsive: options.responsive,
        } : undefined,
      });

      // Store metadata
      await this.contentMetadataRepository.save(metadata);

      // Optimize asynchronously if needed
      if (options.optimize && this.isImageFile(file)) {
        setImmediate(async () => {
          try {
            await this.optimizeContentAsync(metadata, options);
          } catch (error) {
            this.logger.error(`Async optimization failed for ${contentId}:`, error);
          }
        });
      }

      return metadata;
    } catch (error) {
      this.logger.error('Upload failed:', error);
      throw error;
    }
  }

  private async getContentMetadata(contentId: string): Promise<ContentMetadata | null> {
    return this.contentMetadataRepository.findOne({
      where: { contentId },
    });
  }

  private async storeContentMetadata(metadata: ContentMetadata): Promise<void> {
    await this.contentMetadataRepository.save(metadata);
  }

  private async updateAccessStats(metadata: ContentMetadata): Promise<void> {
    metadata.accessCount += 1;
    metadata.lastAccessedAt = new Date();
    await this.contentMetadataRepository.save(metadata);
  }

  private async uploadWithFailover(file: Express.Multer.File): Promise<{
    url: string;
    etag?: string;
    provider: string;
  }> {
    // Try primary provider (Cloudflare)
    try {
      const result = await this.cloudflareService.uploadFile(file);
      return { ...result, provider: 'cloudflare' };
    } catch (error) {
      this.logger.warn('Primary provider failed, trying fallback:', error);

      // Try fallback provider (AWS CloudFront)
      try {
        // Note: AWS service would need to be injected
        // For now, return mock fallback
        throw new Error('AWS provider not implemented in this context');
      } catch (fallbackError) {
        this.logger.error('All providers failed:', fallbackError);
        throw new Error('All CDN providers failed to upload file');
      }
    }
  }

  private async optimizeContentAsync(
    metadata: ContentMetadata,
    options: ContentDeliveryOptions,
  ): Promise<void> {
    try {
      metadata.status = ContentStatus.PROCESSING;
      await this.contentMetadataRepository.save(metadata);

      const optimizedUrl = await this.assetOptimizationService.optimizeImage(
        metadata.cdnUrl,
        options,
      );

      // Generate responsive variants if requested
      let variants = [];
      if (options.responsive) {
        variants = await this.assetOptimizationService.generateResponsiveImages(
          metadata.cdnUrl,
        );
      }

      metadata.status = ContentStatus.OPTIMIZED;
      metadata.optimizedSize = variants.reduce((total, variant) => total + variant.optimizedSize, 0);
      metadata.variants = variants.map(v => ({
        name: v.url.split('/').pop(),
        url: v.url,
        width: options.width || 0,
        height: options.height || 0,
        size: v.optimizedSize,
      }));

      await this.contentMetadataRepository.save(metadata);
    } catch (error) {
      metadata.status = ContentStatus.FAILED;
      metadata.errorMessage = error.message;
      await this.contentMetadataRepository.save(metadata);
      throw error;
    }
  }

  private async optimizeForBandwidth(url: string, bandwidth: number): Promise<string> {
    // Implementation would adjust quality/format based on bandwidth
    // For now, return original URL
    return url;
  }

  private isImageFile(file: Express.Multer.File): boolean {
    return file.mimetype.startsWith('image/');
  }

  private getContentType(file: Express.Multer.File): 'image' | 'video' | 'document' {
    if (file.mimetype.startsWith('image/')) return 'image';
    if (file.mimetype.startsWith('video/')) return 'video';
    return 'document';
  }

  private generateContentId(): string {
    return `cdn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapContentType(mimeType: string): ContentType {
    if (mimeType.startsWith('image/')) return ContentType.IMAGE;
    if (mimeType.startsWith('video/')) return ContentType.VIDEO;
    if (mimeType.startsWith('audio/')) return ContentType.AUDIO;
    return ContentType.DOCUMENT;
  }
}
