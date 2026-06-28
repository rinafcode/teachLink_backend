import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Achievement } from './achievement.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Tracks a user's progress toward an achievement.
 * Used for incremental progress tracking (e.g., lessons completed, streak days).
 */
@Entity('achievement_progress')
@Index(['user', 'achievement'], { unique: true })
export class AchievementProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn()
  @Index()
  user: User;

  @ManyToOne(() => Achievement, (achievement) => achievement.progresses, {
    eager: true,
  })
  @JoinColumn()
  @Index()
  achievement: Achievement;

  /**
   * Current progress value (e.g., lessons completed count)
   */
  @Column({ default: 0 })
  currentProgress: number;

  /**
   * Maximum progress needed to unlock achievement
   */
  @Column({ default: 0 })
  targetProgress: number;

  /**
   * Percentage of completion (0-100)
   */
  @Column({ default: 0 })
  percentageComplete: number;

  /**
   * Whether the user has unlocked this achievement
   */
  @Column({ default: false })
  @Index()
  isUnlocked: boolean;

  /**
   * Last update timestamp for progress
   */
  @Column({ nullable: true })
  lastProgressUpdate?: Date;

  /**
   * Additional metadata for progress tracking
   */
  @Column('jsonb', { nullable: true })
  metadata?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
