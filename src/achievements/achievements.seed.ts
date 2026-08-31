import { AchievementType, AchievementDifficulty } from './entities/achievement.entity';

/**
 * Seed data for default achievements
 * This can be used to populate the database with standard achievements
 */
export const DEFAULT_ACHIEVEMENTS = [
  // Milestone achievements
  {
    name: 'First Lesson',
    description: 'Complete your first lesson',
    longDescription: 'Begin your learning journey by completing your first lesson',
    iconUrl: 'https://example.com/icons/first-lesson.png',
    type: AchievementType.MILESTONE,
    difficulty: AchievementDifficulty.EASY,
    pointsReward: 50,
    experienceReward: 25,
    criteria: {
      type: 'LESSONS_COMPLETED',
      target: 1,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 1,
    },
  },
  {
    name: 'Lesson Enthusiast',
    description: 'Complete 10 lessons',
    longDescription: 'Demonstrates consistent engagement with learning',
    iconUrl: 'https://example.com/icons/lesson-enthusiast.png',
    type: AchievementType.MILESTONE,
    difficulty: AchievementDifficulty.MEDIUM,
    pointsReward: 150,
    experienceReward: 100,
    criteria: {
      type: 'LESSONS_COMPLETED',
      target: 10,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 10,
    },
  },
  {
    name: 'Lesson Master',
    description: 'Complete 50 lessons',
    longDescription: 'You are a dedicated learner',
    iconUrl: 'https://example.com/icons/lesson-master.png',
    type: AchievementType.MILESTONE,
    difficulty: AchievementDifficulty.HARD,
    pointsReward: 500,
    experienceReward: 250,
    criteria: {
      type: 'LESSONS_COMPLETED',
      target: 50,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 50,
    },
  },
  {
    name: 'First Course',
    description: 'Complete your first course',
    longDescription: 'Celebrate completing your first full course',
    iconUrl: 'https://example.com/icons/first-course.png',
    type: AchievementType.MILESTONE,
    difficulty: AchievementDifficulty.EASY,
    pointsReward: 100,
    experienceReward: 50,
    criteria: {
      type: 'COURSES_COMPLETED',
      target: 1,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 1,
    },
  },
  {
    name: 'Course Champion',
    description: 'Complete 5 courses',
    longDescription: 'You have completed multiple courses',
    iconUrl: 'https://example.com/icons/course-champion.png',
    type: AchievementType.MILESTONE,
    difficulty: AchievementDifficulty.HARD,
    pointsReward: 400,
    experienceReward: 200,
    criteria: {
      type: 'COURSES_COMPLETED',
      target: 5,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 5,
    },
  },

  // Streak achievements
  {
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    longDescription: 'Complete at least one lesson every day for a week',
    iconUrl: 'https://example.com/icons/week-warrior.png',
    type: AchievementType.STREAKS,
    difficulty: AchievementDifficulty.MEDIUM,
    pointsReward: 200,
    experienceReward: 100,
    criteria: {
      type: 'DAYS_STREAK',
      target: 7,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 7,
    },
  },
  {
    name: 'Month Marathon',
    description: 'Maintain a 30-day streak',
    longDescription: 'Complete at least one lesson every day for a month',
    iconUrl: 'https://example.com/icons/month-marathon.png',
    type: AchievementType.STREAKS,
    difficulty: AchievementDifficulty.HARD,
    pointsReward: 600,
    experienceReward: 300,
    criteria: {
      type: 'DAYS_STREAK',
      target: 30,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 30,
    },
  },
  {
    name: 'Unstoppable',
    description: 'Maintain a 100-day streak',
    longDescription: 'An incredible display of dedication and consistency',
    iconUrl: 'https://example.com/icons/unstoppable.png',
    type: AchievementType.STREAKS,
    difficulty: AchievementDifficulty.LEGENDARY,
    pointsReward: 2000,
    experienceReward: 1000,
    criteria: {
      type: 'DAYS_STREAK',
      target: 100,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 100,
    },
  },

  // Skill-based achievements
  {
    name: 'Quick Learner',
    description: 'Complete a lesson in under 5 minutes',
    longDescription: 'Demonstrates rapid comprehension',
    iconUrl: 'https://example.com/icons/quick-learner.png',
    type: AchievementType.SKILL_BASED,
    difficulty: AchievementDifficulty.MEDIUM,
    pointsReward: 150,
    experienceReward: 75,
    criteria: {
      type: 'LESSON_TIME',
      target: 5,
      unit: 'minutes',
    },
    progressConfig: {
      trackingType: 'binary',
      maxProgress: 1,
    },
  },
  {
    name: 'Perfect Score',
    description: 'Achieve 100% on a lesson assessment',
    longDescription: 'Demonstrates mastery of the material',
    iconUrl: 'https://example.com/icons/perfect-score.png',
    type: AchievementType.SKILL_BASED,
    difficulty: AchievementDifficulty.HARD,
    pointsReward: 300,
    experienceReward: 150,
    criteria: {
      type: 'ASSESSMENT_SCORE',
      target: 100,
    },
    progressConfig: {
      trackingType: 'binary',
      maxProgress: 1,
    },
  },

  // Engagement achievements
  {
    name: 'Early Bird',
    description: 'Complete a lesson before 9 AM',
    longDescription: 'Start your day with learning',
    iconUrl: 'https://example.com/icons/early-bird.png',
    type: AchievementType.ENGAGEMENT,
    difficulty: AchievementDifficulty.EASY,
    pointsReward: 50,
    experienceReward: 25,
    criteria: {
      type: 'COMPLETION_TIME',
      target: '09:00',
    },
    progressConfig: {
      trackingType: 'binary',
      maxProgress: 1,
    },
  },
  {
    name: 'Active Participant',
    description: 'Post 5 discussion comments',
    longDescription: 'Engage with the learning community',
    iconUrl: 'https://example.com/icons/active-participant.png',
    type: AchievementType.ENGAGEMENT,
    difficulty: AchievementDifficulty.MEDIUM,
    pointsReward: 200,
    experienceReward: 100,
    criteria: {
      type: 'DISCUSSION_POSTS',
      target: 5,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 5,
    },
  },
  {
    name: 'Community Helper',
    description: 'Receive 10 helpful votes on forum posts',
    longDescription: 'Help others in the community',
    iconUrl: 'https://example.com/icons/community-helper.png',
    type: AchievementType.ENGAGEMENT,
    difficulty: AchievementDifficulty.HARD,
    pointsReward: 400,
    experienceReward: 200,
    criteria: {
      type: 'HELPFUL_VOTES',
      target: 10,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 10,
    },
  },

  // Contribution achievements
  {
    name: 'Educator',
    description: 'Create your first course',
    longDescription: 'Share your knowledge with others',
    iconUrl: 'https://example.com/icons/educator.png',
    type: AchievementType.CONTRIBUTION,
    difficulty: AchievementDifficulty.HARD,
    pointsReward: 500,
    experienceReward: 250,
    criteria: {
      type: 'COURSES_CREATED',
      target: 1,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 1,
    },
  },
  {
    name: 'Course Creator',
    description: 'Create 5 courses',
    longDescription: 'Establish yourself as a course creator',
    iconUrl: 'https://example.com/icons/course-creator.png',
    type: AchievementType.CONTRIBUTION,
    difficulty: AchievementDifficulty.LEGENDARY,
    pointsReward: 1500,
    experienceReward: 750,
    criteria: {
      type: 'COURSES_CREATED',
      target: 5,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 5,
    },
  },
  {
    name: 'Lesson Author',
    description: 'Create 10 lessons',
    longDescription: 'Create comprehensive learning content',
    iconUrl: 'https://example.com/icons/lesson-author.png',
    type: AchievementType.CONTRIBUTION,
    difficulty: AchievementDifficulty.HARD,
    pointsReward: 600,
    experienceReward: 300,
    criteria: {
      type: 'LESSONS_CREATED',
      target: 10,
    },
    progressConfig: {
      trackingType: 'incremental',
      maxProgress: 10,
    },
  },
];

/**
 * Helper function to seed achievements into the database
 */
export async function seedAchievements(achievementsService: any): Promise<void> {
  try {
    for (const achievementData of DEFAULT_ACHIEVEMENTS) {
      await achievementsService.createAchievement(achievementData);
    }
    console.log(`✅ Seeded ${DEFAULT_ACHIEVEMENTS.length} achievements`);
  } catch (error) {
    console.error('❌ Error seeding achievements:', error);
  }
}
