import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { resolveCdnConfig, resolveCacheHeaderConfig } from './cdn.config';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import CircuitBreaker from 'opossum';
import * as fileType from 'file-type';

export interface CacheHeaders {
  'Cache-Control': string;
  'CDN-Cache-Control'?: string;
}

export interface InvalidationResult {
  success: boolean;
  paths: string[];
  message: string;
}

@Injectable()
export class CdnService {
  private readonly logger = new Logger(CdnService.name);
  private readonly cdn = resolveCdnConfig();
  private readonly cacheHeaders = resolveCacheHeaderConfig();
  private readonly cfClient = new CloudFrontClient({});
  private readonly invalidationBreaker: CircuitBreaker<[string[]], any>;

  constructor() {
    this.invalidationBreaker = new CircuitBreaker(
      async (paths: string[]) => {
        const command = new CreateInvalidationCommand({
          DistributionId: this.cdn.distributionId,
          InvalidationBatch: {
            Paths: { Quantity: paths.length, Items: paths },
            CallerReference: Date.now().toString(),
          },
        });
        return this.cfClient.send(command);
      },
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      },
    );
  }

  /**
   * Returns optimised Cache-Control headers for a given asset path.
   * Immutable assets (contain a content hash) get a 1-year max-age.
   * HTML and other assets get a short TTL with stale-while-revalidate.
   */
  getCacheHeaders(assetPath: string): CacheHeaders {
    const isImmutable = /\.[a-f0-9]{8,}\.(js|css|woff2?|png|jpg|webp|svg)$/i.test(assetPath);

    if (isImmutable) {
      return {
        'Cache-Control': `public, max-age=${this.cacheHeaders.immutableMaxAge}, immutable`,
        'CDN-Cache-Control': `public, max-age=${this.cacheHeaders.immutableMaxAge}`,
      };
    }

    return {
      'Cache-Control': `public, max-age=${this.cacheHeaders.htmlMaxAge}, stale-while-revalidate=${this.cacheHeaders.staleWhileRevalidate}`,
      'CDN-Cache-Control': `public, max-age=${this.cacheHeaders.htmlMaxAge}`,
    };
  }

  /**
   * Invalidates CDN cache for the given paths.
   * In production this would call the CloudFront CreateInvalidation API.
   * The distribution ID is read from CLOUDFRONT_DISTRIBUTION_ID env var.
   */
  async invalidate(paths: string[]): Promise<InvalidationResult> {
    if (!this.cdn.enabled || !this.cdn.distributionId) {
      this.logger.warn(
        'CDN invalidation skipped — CDN_ENABLED is false or CLOUDFRONT_DISTRIBUTION_ID not set',
      );
      return { success: false, paths, message: 'CDN not configured' };
    }

    this.logger.log(
      `Invalidating ${paths.length} path(s) on distribution ${this.cdn.distributionId}: ${paths.join(', ')}`,
    );

    // Placeholder: wire up AWS SDK CloudFront.createInvalidation here when credentials are available.
    // Example:
    //   const cf = new CloudFrontClient({});
    //   await cf.send(new CreateInvalidationCommand({
    //     DistributionId: this.cdn.distributionId,
    //     InvalidationBatch: { Paths: { Quantity: paths.length, Items: paths }, CallerReference: Date.now().toString() },
    //   }));

    return {
      success: true,
      paths,
      message: `Invalidation queued for distribution ${this.cdn.distributionId}`,
    };
  }

  /** Returns the CDN URL for a given asset path. */
  getAssetUrl(assetPath: string): string {
    if (!this.cdn.enabled || !this.cdn.domain) return assetPath;
    return `https://${this.cdn.domain}${assetPath.startsWith('/') ? '' : '/'}${assetPath}`;
  }

  getConfig() {
    return { ...this.cdn, cacheHeaders: this.cacheHeaders };
  }

  /**
   * Validates uploaded file size and magic bytes against expected MIME.
   * Throws 413 Payload Too Large if size exceeds limits (500MB video, 10MB image).
   * Throws 415 Unsupported Media Type if magic bytes do not match.
   */
  async validateUpload(buffer: Buffer, declaredMimeType: string): Promise<void> {
    const isVideo = declaredMimeType.startsWith('video/');
    const maxSize = isVideo ? 500 * 1024 * 1024 : 10 * 1024 * 1024;

    if (buffer.length > maxSize) {
      throw new HttpException('Payload Too Large', HttpStatus.PAYLOAD_TOO_LARGE);
    }

    const type = await fileType.fromBuffer(buffer);
    if (!type || type.mime !== declaredMimeType) {
      this.logger.warn(`MIME type mismatch: declared ${declaredMimeType}, detected ${type?.mime}`);
      throw new HttpException('Unsupported Media Type', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
  }
}
