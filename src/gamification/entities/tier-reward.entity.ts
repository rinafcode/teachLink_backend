import { Entity, PrimaryGeneratedColumn, Column, VersionColumn } from 'typeorm';
import { Tier } from '../enums/tier.enum';

/**
 * Defines the reward granted when a user reaches a specific tier.
 */
@Entity('tier_rewards')
export class TierReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ type: 'enum', enum: Tier, unique: true })
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
