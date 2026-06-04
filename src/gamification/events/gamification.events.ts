export const GAMIFICATION_EVENTS = {
  COURSE_COMPLETED: 'gamification.course.completed',
  ASSESSMENT_SUBMITTED: 'gamification.assessment.submitted',
  POINTS_AWARDED: 'gamification.points.awarded',
  REVIEW_WRITTEN: 'gamification.review.written',
  COURSE_CREATED: 'gamification.course.created',
  USER_LOGIN: 'gamification.user.login',
} as const;

export class CourseCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly courseId: string,
    public readonly totalCoursesCompleted: number,
  ) {}
}

export class AssessmentSubmittedEvent {
  constructor(
    public readonly userId: string,
    public readonly assessmentId: string,
    public readonly score: number,
    public readonly totalPassed: number,
  ) {}
}

export class PointsAwardedEvent {
  constructor(
    public readonly userId: string,
    public readonly totalPoints: number,
    public readonly level: number,
  ) {}
}

export class ReviewWrittenEvent {
  constructor(
    public readonly userId: string,
    public readonly totalReviews: number,
  ) {}
}

export class CourseCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly totalCoursesCreated: number,
  ) {}
}
