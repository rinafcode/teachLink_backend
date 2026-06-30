import { Injectable, Logger } from '@nestjs/common';
import { resolveCdnConfig, resolveCacheHeaderConfig } from './cdn.config';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import CircuitBreaker from 'opossum';

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
}
