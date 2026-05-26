import { Injectable } from '@nestjs/common';
import { QUOTA_LIMITS } from '../rate-limiting.constants';

export enum UserTier {
    FREE = 'FREE',
    PRO = 'PRO',
    PREMIUM = 'PREMIUM'
}

/**
 * Provides quota Management operations.
 */
@Injectable()
export class QuotaManagementService {
  /**
   * Retrieves quota For Tier.
   * @param tier The tier.
   * @returns The operation result.
   */
  getQuotaForTier(tier: UserTier) {
    return QUOTA_LIMITS[tier] || QUOTA_LIMITS.DEFAULT;
  }
}
