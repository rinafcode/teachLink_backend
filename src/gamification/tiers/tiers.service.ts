import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tier } from '../enums/tier.enum';
import { TierReward } from '../entities/tier-reward.entity';

/** Minimum total points required to reach each tier */
export const TIER_THRESHOLDS: Record<Tier, number> = {
  [Tier.BRONZE]: 0,
  [Tier.SILVER]: 1000,
  [Tier.GOLD]: 5000,
  [Tier.PLATINUM]: 15000,
  [Tier.DIAMOND]: 50000,
};

/** Ordered list of tiers from lowest to highest */
const TIER_ORDER: Tier[] = [Tier.BRONZE, Tier.SILVER, Tier.GOLD, Tier.PLATINUM, Tier.DIAMOND];

@Injectable()
export class TiersService {
  constructor(
    @InjectRepository(TierReward)
    private tierRewardRepository: Repository<TierReward>,
  ) {}

  /** Determine the tier for a given total points value */
  getTierForPoints(totalPoints: number): Tier {
    let tier = Tier.BRONZE;
    for (const t of TIER_ORDER) {
      if (totalPoints >= TIER_THRESHOLDS[t]) {
        tier = t;
      }
    }
    return tier;
  }

  /** Return the next tier above the given one, or null if already at max */
  getNextTier(current: Tier): Tier | null {
    const idx = TIER_ORDER.indexOf(current);
    return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
  }

  /** Points needed to reach the next tier from current total */
  pointsToNextTier(totalPoints: number): number | null {
    const currentTier = this.getTierForPoints(totalPoints);
    const next = this.getNextTier(currentTier);
    if (!next) return null;
    return TIER_THRESHOLDS[next] - totalPoints;
  }

  async getRewardForTier(tier: Tier): Promise<TierReward | null> {
    return this.tierRewardRepository.findOne({ where: { tier } });
  }

  async getAllRewards(): Promise<TierReward[]> {
    return this.tierRewardRepository.find({ order: { tier: 'ASC' } });
  }

  async upsertReward(
    tier: Tier,
    data: Partial<Omit<TierReward, 'id' | 'version' | 'tier'>>,
  ): Promise<TierReward> {
    const existing = await this.tierRewardRepository.findOne({ where: { tier } });
    if (existing) {
      Object.assign(existing, data);
      return this.tierRewardRepository.save(existing);
    }
    return this.tierRewardRepository.save(this.tierRewardRepository.create({ tier, ...data }));
  }
}
