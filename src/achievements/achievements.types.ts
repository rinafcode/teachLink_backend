/**
 * Achievement Types - Define what kind of achievement it is
 */
export enum AchievementTypeEnum {
  MILESTONE = 'milestone', // Reached a target (e.g., 10 lessons)
  CHALLENGE = 'challenge', // Complete a specific challenge
  STREAKS = 'streaks', // Maintain consistency (e.g., 7-day streak)
  SKILL_BASED = 'skill_based', // Demonstrate skill mastery
  ENGAGEMENT = 'engagement', // Community participation
  CONTRIBUTION = 'contribution', // Content creation
}

/**
 * Achievement Difficulty - Indicates challenge level
 */
export enum AchievementDifficultyEnum {
  EASY = 'easy', // 5-10 minutes to unlock
  MEDIUM = 'medium', // 30 minutes to 2 hours
  HARD = 'hard', // Days to weeks
  LEGENDARY = 'legendary', // Months of commitment
}

/**
 * Progress Configuration Type
 */
export interface ProgressConfig {
  trackingType: 'incremental' | 'binary'; // Incremental = count-based, Binary = yes/no
  maxProgress: number; // Target value to unlock
}

/**
 * Achievement Criteria - Define unlock conditions
 */
export interface AchievementCriteria {
  type: string; // e.g., 'LESSONS_COMPLETED', 'COURSES_COMPLETED', 'DAYS_STREAK'
  target: number; // Target value to reach
  [key: string]: any; // Additional criteria-specific fields
}

/**
 * Achievement Metadata
 */
export interface AchievementMetadata {
  category?: string;
  tags?: string[];
  prerequisites?: string[]; // Achievement IDs required before this one
  seasonalStart?: Date;
  seasonalEnd?: Date;
  maxUnlocks?: number; // Limit how many can unlock this
  [key: string]: any;
}

/**
 * Progress Update Context
 */
export interface ProgressContext {
  [key: string]: any; // Context data (e.g., lessonId, courseId, etc.)
}

/**
 * Unlock Context
 */
export interface UnlockContext {
  reason?: string; // e.g., 'auto_unlock', 'manual_award', 'challenge_complete'
  triggeredBy?: string; // User/system ID that triggered unlock
  [key: string]: any; // Additional context
}

/**
 * Statistics Timeframe
 */
export enum StatisticsTimeframe {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  ALL_TIME = 'all_time',
}

/**
 * Engagement Trend
 */
export enum EngagementTrend {
  POSITIVE = 'positive', // Increasing unlock rate
  NEGATIVE = 'negative', // Decreasing unlock rate
  STABLE = 'stable', // Stable unlock rate
}

/**
 * Achievement Status (user-specific)
 */
export enum UserAchievementStatus {
  LOCKED = 'locked', // Not started or in progress
  IN_PROGRESS = 'in_progress', // Making progress
  NEARLY_UNLOCKED = 'nearly_unlocked', // >80% progress
  UNLOCKED = 'unlocked', // Achievement earned
  EXPIRED = 'expired', // Time-limited achievement expired
}

/**
 * Criteria Type Constants
 */
export const CRITERIA_TYPES = {
  LESSONS_COMPLETED: 'LESSONS_COMPLETED',
  COURSES_COMPLETED: 'COURSES_COMPLETED',
  DAYS_STREAK: 'DAYS_STREAK',
  ASSESSMENT_SCORE: 'ASSESSMENT_SCORE',
  DISCUSSION_POSTS: 'DISCUSSION_POSTS',
  HELPFUL_VOTES: 'HELPFUL_VOTES',
  COURSES_CREATED: 'COURSES_CREATED',
  LESSONS_CREATED: 'LESSONS_CREATED',
  LESSON_TIME: 'LESSON_TIME',
  COMPLETION_TIME: 'COMPLETION_TIME',
  PEER_REVIEWS: 'PEER_REVIEWS',
  QUIZ_SCORE: 'QUIZ_SCORE',
  FORUM_CONTRIBUTIONS: 'FORUM_CONTRIBUTIONS',
  COURSE_RATING: 'COURSE_RATING',
  COURSE_COMPLETION_RATE: 'COURSE_COMPLETION_RATE',
} as const;

/**
 * Default Reward by Difficulty
 */
export const DIFFICULTY_REWARDS = {
  [AchievementDifficultyEnum.EASY]: {
    points: 50,
    experience: 25,
  },
  [AchievementDifficultyEnum.MEDIUM]: {
    points: 150,
    experience: 100,
  },
  [AchievementDifficultyEnum.HARD]: {
    points: 400,
    experience: 200,
  },
  [AchievementDifficultyEnum.LEGENDARY]: {
    points: 1500,
    experience: 750,
  },
};

/**
 * Achievement Query Options
 */
export interface AchievementQueryOptions {
  type?: AchievementTypeEnum;
  difficulty?: AchievementDifficultyEnum;
  isActive?: boolean;
  isHidden?: boolean;
  sortBy?: 'difficulty' | 'createdAt' | 'unlockedBy' | 'pointsReward';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

/**
 * Statistics Query Options
 */
export interface StatisticsQueryOptions {
  achievementId?: string;
  startDate?: Date;
  endDate?: Date;
  timeframe?: StatisticsTimeframe;
  minUnlocks?: number;
  maxUnlocks?: number;
}

/**
 * Leaderboard Options
 */
export interface LeaderboardOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'totalAchievements' | 'totalPoints' | 'totalExperience' | 'unlockedRecently';
}

/**
 * Bulk Operation Options
 */
export interface BulkOperationOptions {
  dryRun?: boolean; // Test without actually saving
  notifyUsers?: boolean; // Send notifications
  logChanges?: boolean; // Log all changes
}
