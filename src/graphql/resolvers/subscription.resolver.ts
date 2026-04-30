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
  /**
   * Executes user Created.
   * @returns The operation result.
   */
  @Subscription(() => UserType, {
    name: 'userCreated',
    description: 'Subscribe to new user creation events',
  })
  userCreated() {
    return this.pubSub.asyncIterableIterator('userCreated');
  }

  /**
   * Executes user Updated.
   * @returns The operation result.
   */
  @Subscription(() => UserType, {
    name: 'userUpdated',
    description: 'Subscribe to user update events',
  })
  userUpdated() {
    return this.pubSub.asyncIterableIterator('userUpdated');
  }

  /**
   * Executes user Deleted.
   * @returns The operation result.
   */
  @Subscription(() => UserType, {
    name: 'userDeleted',
    description: 'Subscribe to user deletion events',
  })
  userDeleted() {
    return this.pubSub.asyncIterableIterator('userDeleted');
  }

  // Course Subscriptions
  /**
   * Executes course Created.
   * @returns The operation result.
   */
  @Subscription(() => CourseType, {
    name: 'courseCreated',
    description: 'Subscribe to new course creation events',
  })
  courseCreated() {
    return this.pubSub.asyncIterableIterator('courseCreated');
  }

  /**
   * Executes course Updated.
   * @returns The operation result.
   */
  @Subscription(() => CourseType, {
    name: 'courseUpdated',
    description: 'Subscribe to course update events',
  })
  courseUpdated() {
    return this.pubSub.asyncIterableIterator('courseUpdated');
  }

  /**
   * Executes course Deleted.
   * @returns The operation result.
   */
  @Subscription(() => CourseType, {
    name: 'courseDeleted',
    description: 'Subscribe to course deletion events',
  })
  courseDeleted() {
    return this.pubSub.asyncIterableIterator('courseDeleted');
  }

  // Assessment Subscriptions
  /**
   * Executes assessment Created.
   * @returns The operation result.
   */
  @Subscription(() => AssessmentType, {
    name: 'assessmentCreated',
    description: 'Subscribe to new assessment creation events',
  })
  assessmentCreated() {
    return this.pubSub.asyncIterableIterator('assessmentCreated');
  }

  /**
   * Executes assessment Updated.
   * @returns The operation result.
   */
  @Subscription(() => AssessmentType, {
    name: 'assessmentUpdated',
    description: 'Subscribe to assessment update events',
  })
  assessmentUpdated() {
    return this.pubSub.asyncIterableIterator('assessmentUpdated');
  }

  /**
   * Executes assessment Deleted.
   * @returns The operation result.
   */
  @Subscription(() => AssessmentType, {
    name: 'assessmentDeleted',
    description: 'Subscribe to assessment deletion events',
  })
  assessmentDeleted() {
    return this.pubSub.asyncIterableIterator('assessmentDeleted');
  }
}
