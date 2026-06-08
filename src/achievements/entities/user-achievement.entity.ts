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
 * Represents an achievement that has been unlocked by a user.
 * Records the timestamp and metadata of when/how the achievement was earned.
 */
@Entity('user_achievements')
@Index(['user', 'achievement'], { unique: true })
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn()
  @Index()
  user: User;

  @ManyToOne(() => Achievement, (achievement) => achievement.userAchievements, {
    eager: true,
  })
  @JoinColumn()
  @Index()
  achievement: Achievement;

  /**
   * Timestamp when the achievement was unlocked
   */
  @Column()
  @Index()
  unlockedAt: Date;

  /**
   * Additional metadata about how the achievement was earned
   * e.g., { context: 'course_completion', relatedId: 'course-123' }
   */
  @Column('jsonb', { nullable: true })
  unlockedMetadata?: any;

  /**
   * Points earned from this achievement
   */
  @Column({ default: 0 })
  pointsEarned: number;

  /**
   * Experience earned from this achievement
   */
  @Column({ default: 0 })
  experienceEarned: number;

  /**
   * Whether a notification was sent to the user
   */
  @Column({ default: false })
  notificationSent: boolean;

  /**
   * Whether the achievement is hidden from the user
   */
  @Column({ default: false })
  isHidden: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
