import { Injectable } from '@nestjs/common';

const TIER_DAILY_QUOTA = {
  free: 1000,
  basic: 5000,
  premium: Infinity,
};

@Injectable()
export class QuotaManagementService {
  private userQuota: Map<string, { date: string; count: number }> = new Map();

  isAllowed(userId: string, tier: string, endpoint: string): boolean {
    if (tier === 'premium') return true;
    const today = new Date().toISOString().slice(0, 10);
    const key = `${userId}:${endpoint}`;
    let quota = this.userQuota.get(key);
    if (!quota || quota.date !== today) {
      quota = { date: today, count: 1 };
      this.userQuota.set(key, quota);
      return true;
    }
    if (quota.count < (TIER_DAILY_QUOTA[tier] || TIER_DAILY_QUOTA['free'])) {
      quota.count++;
      return true;
    }
    return false;
  }
}
