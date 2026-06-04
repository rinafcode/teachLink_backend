import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * Tracks achievement system statistics for analytics and monitoring.
 * Used to report on achievement unlock rates, trends, and user engagement.
 */
@Entity('achievement_statistics')
@Index(['achievementId', 'date'])
export class AchievementStatistics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  @Index()
  achievementId: string;

  /**
   * Date of the statistic snapshot
   */
  @Column({ type: 'date' })
  @Index()
  date: Date;

  /**
   * Total number of users who have unlocked this achievement
   */
  @Column({ default: 0 })
  totalUnlocked: number;

  /**
   * Number of users who unlocked today
   */
  @Column({ default: 0 })
  unlockedToday: number;

  /**
   * Percentage of total users who have this achievement
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  unlockedPercentage: number;

  /**
   * Average time to unlock (in days)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  averageTimeToUnlock?: number;

  /**
   * Number of users currently tracking progress
   */
  @Column({ default: 0 })
  activeTrackers: number;

  /**
   * Average progress percentage for users tracking this achievement
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  averageProgress: number;

  /**
   * Engagement trend (positive/negative/stable)
   */
  @Column({ nullable: true })
  engagementTrend?: 'positive' | 'negative' | 'stable';

  /**
   * Custom metadata for additional stats
   */
  @Column('jsonb', { nullable: true })
  metadata?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
