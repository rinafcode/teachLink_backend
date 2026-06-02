/**
 * Event Tracking SDK for TeachLink
 * 
 * This SDK provides a simple interface for tracking user events throughout the application.
 * Events are validated against schemas and batched for performance.
 * 
 * Usage:
 * ```typescript
 * import { EventTrackingSDK } from '@/analytics/sdk/event-tracking.sdk';
 * 
 * const sdk = new EventTrackingSDK(trackingService);
 * 
 * // Track a user signup
 * await sdk.trackSignup(userId, { source: 'organic' });
 * 
 * // Track a course purchase
 * await sdk.trackPurchase(userId, courseId, amount);
 * 
 * // Track a custom event
 * await sdk.trackCustom('engagement', 'button_click', { buttonId: 'hero-cta' });
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventType } from '../entities/event.entity';

export interface IEventTracker {
  trackSignup(userId: string, metadata?: Record<string, any>): Promise<void>;
  trackLogin(userId: string, metadata?: Record<string, any>): Promise<void>;
  trackCourseView(userId: string, courseId: string, metadata?: Record<string, any>): Promise<void>;
  trackPurchase(
    userId: string,
    courseId: string,
    amount: number,
    metadata?: Record<string, any>,
  ): Promise<void>;
  trackCourseEnroll(userId: string, courseId: string, metadata?: Record<string, any>): Promise<void>;
  trackLessonComplete(userId: string, lessonId: string, metadata?: Record<string, any>): Promise<void>;
  trackQuizAttempt(
    userId: string,
    quizId: string,
    score: number,
    metadata?: Record<string, any>,
  ): Promise<void>;
  trackCourseComplete(userId: string, courseId: string, metadata?: Record<string, any>): Promise<void>;
  trackSearch(query: string, userId?: string, resultCount?: number): Promise<void>;
  trackWishlistAdd(userId: string, courseId: string): Promise<void>;
  trackReview(userId: string, courseId: string, rating: number): Promise<void>;
  trackCustom(
    category: string,
    action: string,
    properties?: Record<string, any>,
    userId?: string,
  ): Promise<void>;
}

@Injectable()
export class EventTrackingSDK implements IEventTracker {
  private readonly logger = new Logger(EventTrackingSDK.name);

  constructor(private readonly trackingService: any) {}

  async trackSignup(userId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.SIGNUP,
      category: 'user',
      action: 'signup',
      userId,
      properties: metadata,
    });
  }

  async trackLogin(userId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.LOGIN,
      category: 'user',
      action: 'login',
      userId,
      properties: metadata,
    });
  }

  async trackCourseView(
    userId: string,
    courseId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.COURSE_VIEW,
      category: 'course',
      action: 'view',
      label: courseId,
      userId,
      properties: {
        courseId,
        ...metadata,
      },
    });
  }

  async trackPurchase(
    userId: string,
    courseId: string,
    amount: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.PURCHASE,
      category: 'purchase',
      action: 'course_purchase',
      label: courseId,
      value: amount,
      userId,
      properties: {
        courseId,
        amount,
        ...metadata,
      },
    });
  }

  async trackCourseEnroll(
    userId: string,
    courseId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.COURSE_ENROLL,
      category: 'course',
      action: 'enroll',
      label: courseId,
      userId,
      properties: {
        courseId,
        ...metadata,
      },
    });
  }

  async trackLessonComplete(
    userId: string,
    lessonId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.LESSON_COMPLETE,
      category: 'lesson',
      action: 'complete',
      label: lessonId,
      userId,
      properties: {
        lessonId,
        ...metadata,
      },
    });
  }

  async trackQuizAttempt(
    userId: string,
    quizId: string,
    score: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.QUIZ_ATTEMPT,
      category: 'assessment',
      action: 'quiz_attempt',
      label: quizId,
      value: score,
      userId,
      properties: {
        quizId,
        score,
        ...metadata,
      },
    });
  }

  async trackCourseComplete(
    userId: string,
    courseId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.COURSE_COMPLETE,
      category: 'course',
      action: 'complete',
      label: courseId,
      userId,
      properties: {
        courseId,
        ...metadata,
      },
    });
  }

  async trackSearch(query: string, userId?: string, resultCount?: number): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.SEARCH,
      category: 'search',
      action: 'query',
      label: query,
      value: resultCount,
      userId,
      properties: {
        query,
        resultCount,
      },
    });
  }

  async trackWishlistAdd(userId: string, courseId: string): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.WISHLIST_ADD,
      category: 'wishlist',
      action: 'add',
      label: courseId,
      userId,
      properties: {
        courseId,
      },
    });
  }

  async trackReview(userId: string, courseId: string, rating: number): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.REVIEW_SUBMIT,
      category: 'review',
      action: 'submit',
      label: courseId,
      value: rating,
      userId,
      properties: {
        courseId,
        rating,
      },
    });
  }

  async trackCustom(
    category: string,
    action: string,
    properties?: Record<string, any>,
    userId?: string,
  ): Promise<void> {
    await this.trackingService.trackEvent({
      eventType: EventType.CUSTOM,
      category,
      action,
      userId,
      properties,
    });
  }
}
