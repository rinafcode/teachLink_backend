export interface CDNConfig {
  cloudflare: {
    apiToken: string;
    zoneId: string;
    accountId: string;
  };
  awsCloudFront: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    distributionId: string;
  };
}

export interface OptimizationOptions {
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  width?: number;
  height?: number;
  progressive?: boolean;
  lossless?: boolean;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  region?: string;
  provider?: string;
}

export interface GeoLocation {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface BandwidthOptimization {
  connectionType: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'wifi';
  quality: 'low' | 'medium' | 'high' | 'auto';
  format: string;
}

export interface CDNResponse {
  url: string;
  provider: string;
  region: string;
  cached: boolean;
  optimized: boolean;
  size: number;
  metadata?: Record<string, any>;
}
