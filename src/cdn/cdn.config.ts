export interface CdnConfig {
  distributionId: string;
  domain: string;
  enabled: boolean;
}

export interface CacheHeaderConfig {
  /** Max-age for immutable assets (JS/CSS with content hash) in seconds. */
  immutableMaxAge: number;
  /** Max-age for HTML and other frequently-changing assets in seconds. */
  htmlMaxAge: number;
  /** Stale-while-revalidate window in seconds. */
  staleWhileRevalidate: number;
}

export function resolveCdnConfig(): CdnConfig {
  return {
    distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID ?? '',
    domain: process.env.CDN_DOMAIN ?? '',
    enabled: process.env.CDN_ENABLED === 'true',
  };
}

export function resolveCacheHeaderConfig(): CacheHeaderConfig {
  return {
    immutableMaxAge: parseInt(process.env.CDN_IMMUTABLE_MAX_AGE ?? '31536000', 10), // 1 year
    htmlMaxAge: parseInt(process.env.CDN_HTML_MAX_AGE ?? '300', 10), // 5 min
    staleWhileRevalidate: parseInt(process.env.CDN_SWR ?? '60', 10),
  };
}
