/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { EventTrackingService } from '../events/event-tracking.service';

@Injectable()
export class LearningMetricsService {
  constructor(private readonly eventTrackingService: EventTrackingService) {}

  // Example: get learning outcomes for a course
  async getMetrics(courseId: string) {
    if (!courseId) {
      throw new Error('Course ID is required');
    }

    // Fetch course-related events - e.g., completions, quiz passes, etc
    const completions = await this.eventTrackingService.getEvents({
      courseId,
      eventType: 'course-completion',
    });

    const quizPasses = await this.eventTrackingService.getEvents({
      courseId,
      eventType: 'quiz-pass',
    });

    // Return simple metrics summary
    return {
      courseId,
      completionsCount: completions.length,
      quizPassCount: quizPasses.length,
      // Add more metrics here...
    };
  }
}
