import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserTier, QuotaResetPeriod } from '../rate-limiting.constants';

/**
 * Tracks real-time request consumption per user per reset window.
 * One row per (userId, period) combination; reset by the scheduler.
 */
@Entity('user_quota_usage')
@Index(['userId', 'period'], { unique: true })
export class UserQuotaUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'enum', enum: UserTier, default: UserTier.FREE })
  tier: UserTier;

  /** MINUTELY | HOURLY | DAILY */
  @Column()
  period: QuotaResetPeriod;

  /** Current consumption for this window */
  @Column({ type: 'int', default: 0 })
  count: number;

  /** When the current window started */
  @Column({ type: 'timestamp' })
  windowStart: Date;

  /** When the current window ends (for quick comparisons) */
  @Column({ type: 'timestamp' })
  windowEnd: Date;

  /** Whether this user is currently blocked due to overage */
  @Column({ default: false })
  isBlocked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
