import { BadgeCategory } from '../enums/badge-category.enum';
import { BadgeCriteriaType } from '../enums/badge-criteria-type.enum';

export const DEFAULT_BADGES = [
  // --- LEARNING ---
  {
    name: 'First Step',
    description: 'Complete your first course',
    category: BadgeCategory.LEARNING,
    criteriaType: BadgeCriteriaType.COURSES_COMPLETED,
    criteriaValue: { threshold: 1 },
    points: 50,
  },
  {
    name: 'Course Collector',
    description: 'Complete 5 courses',
    category: BadgeCategory.LEARNING,
    criteriaType: BadgeCriteriaType.COURSES_COMPLETED,
    criteriaValue: { threshold: 5 },
    points: 200,
  },
  {
    name: 'Scholar',
    description: 'Complete 20 courses',
    category: BadgeCategory.LEARNING,
    criteriaType: BadgeCriteriaType.COURSES_COMPLETED,
    criteriaValue: { threshold: 20 },
    points: 500,
  },
  {
    name: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    category: BadgeCategory.LEARNING,
    criteriaType: BadgeCriteriaType.LEARNING_STREAK_DAYS,
    criteriaValue: { threshold: 7 },
    points: 150,
  },
  // --- ASSESSMENT ---
  {
    name: 'Perfectionist',
    description: 'Score 100% on an assessment',
    category: BadgeCategory.ASSESSMENT,
    criteriaType: BadgeCriteriaType.ASSESSMENT_PERFECT_SCORE,
    criteriaValue: { threshold: 1 },
    points: 100,
  },
  {
    name: 'Test Ace',
    description: 'Pass 10 assessments',
    category: BadgeCategory.ASSESSMENT,
    criteriaType: BadgeCriteriaType.ASSESSMENTS_PASSED,
    criteriaValue: { threshold: 10 },
    points: 300,
  },
  // --- ACHIEVEMENT ---
  {
    name: 'Point Collector',
    description: 'Earn 1,000 points',
    category: BadgeCategory.ACHIEVEMENT,
    criteriaType: BadgeCriteriaType.POINTS_REACHED,
    criteriaValue: { threshold: 1000 },
    points: 100,
  },
  {
    name: 'High Achiever',
    description: 'Reach Level 5',
    category: BadgeCategory.ACHIEVEMENT,
    criteriaType: BadgeCriteriaType.LEVEL_REACHED,
    criteriaValue: { threshold: 5 },
    points: 250,
  },
  // --- SOCIAL ---
  {
    name: 'Critic',
    description: 'Write your first course review',
    category: BadgeCategory.SOCIAL,
    criteriaType: BadgeCriteriaType.REVIEWS_WRITTEN,
    criteriaValue: { threshold: 1 },
    points: 50,
  },
  {
    name: 'Reviewer',
    description: 'Write 10 course reviews',
    category: BadgeCategory.SOCIAL,
    criteriaType: BadgeCriteriaType.REVIEWS_WRITTEN,
    criteriaValue: { threshold: 10 },
    points: 150,
  },
  // --- CONTRIBUTION ---
  {
    name: 'Creator',
    description: 'Publish your first course',
    category: BadgeCategory.CONTRIBUTION,
    criteriaType: BadgeCriteriaType.COURSES_CREATED,
    criteriaValue: { threshold: 1 },
    points: 200,
  },
];
