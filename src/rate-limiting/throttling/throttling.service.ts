import { Injectable } from '@nestjs/common';

interface SlidingWindow {
  windowStart: number;
  requestCount: number;
}

const WINDOW_SIZE = 60 * 1000; // 1 minute
const TIER_LIMITS = {
  free: 30,
  basic: 60,
  premium: 0, // unlimited
};

@Injectable()
export class ThrottlingService {
  private userWindows: Map<string, SlidingWindow> = new Map();

  isAllowed(
    userId: string,
    tier: string,
    endpoint: string,
    ip: string,
  ): boolean {
    if (tier === 'premium') return true;
    const key = `${userId}:${endpoint}`;
    const now = Date.now();
    let window = this.userWindows.get(key);
    if (!window || now - window.windowStart > WINDOW_SIZE) {
      window = { windowStart: now, requestCount: 1 };
      this.userWindows.set(key, window);
      return true;
    }
    if (window.requestCount < (TIER_LIMITS[tier] || TIER_LIMITS['free'])) {
      window.requestCount++;
      return true;
    }
    return false;
  }
}
