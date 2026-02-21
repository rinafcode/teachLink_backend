import { Injectable } from '@nestjs/common';

export enum UserTier {
  FREE = 'FREE',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM',
}

@Injectable()
export class QuotaManagementService {
  getQuotaForTier(tier: UserTier) {
    switch (tier) {
      case UserTier.FREE:
        return { limit: 100, window: 60 };
      case UserTier.PRO:
        return { limit: 500, window: 60 };
      case UserTier.PREMIUM:
        return { limit: Infinity, window: 60 };
      default:
        return { limit: 50, window: 60 };
    }
  }
}