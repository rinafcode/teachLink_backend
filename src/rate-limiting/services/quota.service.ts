import { Injectable } from '@nestjs/common';
import { QUOTA_LIMITS } from '../rate-limiting.constants';

export enum UserTier {
  FREE = 'FREE',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM',
}

@Injectable()
export class QuotaManagementService {
  getQuotaForTier(tier: UserTier) {
    return QUOTA_LIMITS[tier] || QUOTA_LIMITS.DEFAULT;
  }
}
