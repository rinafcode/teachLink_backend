import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  OneToMany,
} from 'typeorm';
import { AchievementProgress } from './achievement-progress.entity';
import { UserAchievement } from './user-achievement.entity';

export enum AchievementType {
  MILESTONE = 'milestone',
  CHALLENGE = 'challenge',
  STREAKS = 'streaks',
  SKILL_BASED = 'skill_based',
  ENGAGEMENT = 'engagement',
  CONTRIBUTION = 'contribution',
}

export enum AchievementDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  LEGENDARY = 'legendary',
}

/**
 * Represents an achievement definition.
 * Achievements are goals that users can unlock by meeting specific criteria.
 */
@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ type: 'text', nullable: true })
  longDescription?: string;

  @Column()
  iconUrl: string;

  @Column({ type: 'enum', enum: AchievementType })
  type: AchievementType;

  @Column({ type: 'enum', enum: AchievementDifficulty })
  difficulty: AchievementDifficulty;

  @Column({ default: 0 })
  pointsReward: number;

  @Column({ default: 100 })
  experienceReward: number;

  /**
   * Criteria for unlocking the achievement
   * Structure: { type: string, target: number, ... }
   * Examples:
   * { type: 'POINTS_REACHED', target: 1000 }
   * { type: 'COURSES_COMPLETED', target: 5 }
   * { type: 'DAYS_STREAK', target: 30 }
   * { type: 'LESSONS_COMPLETED', target: 100 }
   */
  @Column('jsonb', { nullable: true })
  criteria: any;

  /**
   * Progress tracking configuration
   * { trackingType: 'incremental' | 'binary', maxProgress: number }
   */
  @Column('jsonb', { nullable: true })
  progressConfig: any;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: false })
  isHidden: boolean;

  @Column({ nullable: true })
  unlockedBy?: number; // Number of users who have unlocked this

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => AchievementProgress, (progress) => progress.achievement)
  progresses: AchievementProgress[];

  @OneToMany(() => UserAchievement, (userAch) => userAch.achievement)
  userAchievements: UserAchievement[];
}
