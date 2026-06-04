import { Injectable } from '@nestjs/common';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

@Injectable()
export class AdaptiveRateLimitService {
  private readonly baseMax = 100;
  private readonly baseWindowMs = 60_000;

  /**
   * Returns a rate-limit config scaled by current CPU load (0–1).
   * Higher load reduces the allowed request count proportionally.
   */
  getConfig(cpuLoad: number): RateLimitConfig {
    const load = Math.min(Math.max(cpuLoad, 0), 1);
    const scaleFactor = 1 - load * 0.75; // reduce up to 75% under full load
    return {
      maxRequests: Math.max(1, Math.floor(this.baseMax * scaleFactor)),
      windowMs: this.baseWindowMs,
    };
  }

  /**
   * Returns true if the request should be allowed given the current
   * request count within the window and the active config.
   */
  isAllowed(currentCount: number, cpuLoad: number): boolean {
    const { maxRequests } = this.getConfig(cpuLoad);
    return currentCount < maxRequests;
  }
}