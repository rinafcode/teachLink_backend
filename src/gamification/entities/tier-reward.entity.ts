import { Entity, PrimaryGeneratedColumn, Column, VersionColumn, Index } from 'typeorm';
import { Tier } from '../enums/tier.enum';

/**
 * Defines the reward granted when a user reaches a specific tier.
 */
@Entity('tier_rewards')
@Index('IDX_tier_rewards_tier', ['tier'])
export class TierReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn({ default: 1 })
  version: number;

  @Column({ type: 'enum', enum: Tier, unique: true, enumName: 'tier_enum' })
  tier: Tier;

  @Column()
  title: string;

  @Column()
  description: string;

  /** Badge ID to award, if any */
  @Column({ nullable: true })
  badgeId?: string;

  /** Bonus points granted on tier promotion */
  @Column({ default: 0 })
  bonusPoints: number;

  /** Arbitrary reward metadata (e.g. coupon codes, feature unlocks) */
  @Column('jsonb', { nullable: true })
  metadata?: Record<string, unknown>;
}
