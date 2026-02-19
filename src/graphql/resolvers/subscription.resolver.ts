import { Resolver, Subscription } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { UserType } from '../types/user.type';
import { CourseType } from '../types/course.type';
import { AssessmentType } from '../types/assessment.type';

/**
 * Subscription Resolver for real-time GraphQL updates
 * Provides live data streams for entity changes
 */
@Resolver()
export class SubscriptionResolver {
  constructor(@Inject('PUB_SUB') private readonly pubSub: PubSub) {}

  // User Subscriptions
  @Subscription(() => UserType, {
    name: 'userCreated',
    description: 'Subscribe to new user creation events',
  })
  userCreated() {
    return this.pubSub.asyncIterableIterator('userCreated');
  }

  @Subscription(() => UserType, {
    name: 'userUpdated',
    description: 'Subscribe to user update events',
  })
  userUpdated() {
    return this.pubSub.asyncIterableIterator('userUpdated');
  }

  @Subscription(() => UserType, {
    name: 'userDeleted',
    description: 'Subscribe to user deletion events',
  })
  userDeleted() {
    return this.pubSub.asyncIterableIterator('userDeleted');
  }

  // Course Subscriptions
  @Subscription(() => CourseType, {
    name: 'courseCreated',
    description: 'Subscribe to new course creation events',
  })
  courseCreated() {
    return this.pubSub.asyncIterableIterator('courseCreated');
  }

  @Subscription(() => CourseType, {
    name: 'courseUpdated',
    description: 'Subscribe to course update events',
  })
  courseUpdated() {
    return this.pubSub.asyncIterableIterator('courseUpdated');
  }

  @Subscription(() => CourseType, {
    name: 'courseDeleted',
    description: 'Subscribe to course deletion events',
  })
  courseDeleted() {
    return this.pubSub.asyncIterableIterator('courseDeleted');
  }

  // Assessment Subscriptions
  @Subscription(() => AssessmentType, {
    name: 'assessmentCreated',
    description: 'Subscribe to new assessment creation events',
  })
  assessmentCreated() {
    return this.pubSub.asyncIterableIterator('assessmentCreated');
  }

  @Subscription(() => AssessmentType, {
    name: 'assessmentUpdated',
    description: 'Subscribe to assessment update events',
  })
  assessmentUpdated() {
    return this.pubSub.asyncIterableIterator('assessmentUpdated');
  }

  @Subscription(() => AssessmentType, {
    name: 'assessmentDeleted',
    description: 'Subscribe to assessment deletion events',
  })
  assessmentDeleted() {
    return this.pubSub.asyncIterableIterator('assessmentDeleted');
  }
}
