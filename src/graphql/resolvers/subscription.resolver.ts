import { Resolver, Subscription } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { PubSubEngine } from 'graphql-subscriptions';
import { UserType } from '../types/user.type';
import { CourseType } from '../types/course.type';
import { AssessmentType } from '../types/assessment.type';
import { PUB_SUB } from '../subscriptions/pub-sub.provider';
import { SUBSCRIPTION_TOPICS } from '../subscriptions/subscription-topics';

/**
 * Subscription Resolver for real-time GraphQL updates
 * Provides live data streams for entity changes
 */
@Resolver()
export class SubscriptionResolver {
  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSubEngine) {}

  // User Subscriptions
  @Subscription(() => UserType, {
    name: 'userCreated',
    description: 'Subscribe to new user creation events',
  })
  userCreated() {
    return this.pubSub.asyncIterableIterator(SUBSCRIPTION_TOPICS.USER_CREATED);
  }

  @Subscription(() => UserType, {
    name: 'userUpdated',
    description: 'Subscribe to user update events',
  })
  userUpdated() {
    return this.pubSub.asyncIterableIterator(SUBSCRIPTION_TOPICS.USER_UPDATED);
  }

  @Subscription(() => UserType, {
    name: 'userDeleted',
    description: 'Subscribe to user deletion events',
  })
  userDeleted() {
    return this.pubSub.asyncIterableIterator(SUBSCRIPTION_TOPICS.USER_DELETED);
  }

  // Course Subscriptions
  @Subscription(() => CourseType, {
    name: 'courseCreated',
    description: 'Subscribe to new course creation events',
  })
  courseCreated() {
    return this.pubSub.asyncIterableIterator(SUBSCRIPTION_TOPICS.COURSE_CREATED);
  }

  @Subscription(() => CourseType, {
    name: 'courseUpdated',
    description: 'Subscribe to course update events',
  })
  courseUpdated() {
    return this.pubSub.asyncIterableIterator(SUBSCRIPTION_TOPICS.COURSE_UPDATED);
  }

  @Subscription(() => CourseType, {
    name: 'courseDeleted',
    description: 'Subscribe to course deletion events',
  })
  courseDeleted() {
    return this.pubSub.asyncIterableIterator(SUBSCRIPTION_TOPICS.COURSE_DELETED);
  }

  // Assessment Subscriptions
  @Subscription(() => AssessmentType, {
    name: 'assessmentCreated',
    description: 'Subscribe to new assessment creation events',
  })
  assessmentCreated() {
    return this.pubSub.asyncIterableIterator(SUBSCRIPTION_TOPICS.ASSESSMENT_CREATED);
  }

  @Subscription(() => AssessmentType, {
    name: 'assessmentUpdated',
    description: 'Subscribe to assessment update events',
  })
  assessmentUpdated() {
    return this.pubSub.asyncIterableIterator(SUBSCRIPTION_TOPICS.ASSESSMENT_UPDATED);
  }

  @Subscription(() => AssessmentType, {
    name: 'assessmentDeleted',
    description: 'Subscribe to assessment deletion events',
  })
  assessmentDeleted() {
    return this.pubSub.asyncIterableIterator(SUBSCRIPTION_TOPICS.ASSESSMENT_DELETED);
  }
}
