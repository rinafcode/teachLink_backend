export interface RouteConfig {
  service: string;
  upstream: string;
  weight: number;
  cacheTtlSeconds: number;
  rateLimitPerMinute: number;
}

export interface ProxyResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
  cached: boolean;
}

export interface RateLimitState {
  count: number;
  resetAt: number;
}
