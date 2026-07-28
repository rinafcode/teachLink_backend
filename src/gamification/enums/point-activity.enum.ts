export enum PointActivityType {
  COURSE_COMPLETED = 'COURSE_COMPLETED',
  LESSON_COMPLETED = 'LESSON_COMPLETED',
  QUIZ_PASSED = 'QUIZ_PASSED',
  DAILY_LOGIN = 'DAILY_LOGIN',
  PROFILE_COMPLETED = 'PROFILE_COMPLETED',
  FIRST_COURSE_ENROLLED = 'FIRST_COURSE_ENROLLED',
  REVIEW_SUBMITTED = 'REVIEW_SUBMITTED',
  STREAK_BONUS = 'STREAK_BONUS',
}

/** Points awarded per activity type */
export const POINT_RULES: Record<PointActivityType, number> = {
  [PointActivityType.COURSE_COMPLETED]: 500,
  [PointActivityType.LESSON_COMPLETED]: 50,
  [PointActivityType.QUIZ_PASSED]: 100,
  [PointActivityType.DAILY_LOGIN]: 10,
  [PointActivityType.PROFILE_COMPLETED]: 200,
  [PointActivityType.FIRST_COURSE_ENROLLED]: 150,
  [PointActivityType.REVIEW_SUBMITTED]: 75,
  [PointActivityType.STREAK_BONUS]: 25,
};
