import { Resolver, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSubEngine } from 'graphql-subscriptions';
import { UsersService } from '../../users/users.service';
import { CoursesService } from '../../courses/courses.service';
import { AssessmentsService } from '../../assessment/assessments.service';
import { CourseType } from '../types/course.type';
import { AssessmentType } from '../types/assessment.type';
import { UserType } from '../types/user.type';
import { CreateUserInput, UpdateUserInput } from '../inputs/user.input';
import { CreateCourseInput, UpdateCourseInput } from '../inputs/course.input';
import { CreateAssessmentInput, UpdateAssessmentInput } from '../inputs/assessment.input';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PUB_SUB } from '../subscriptions/pub-sub.provider';
import { SUBSCRIPTION_TOPICS } from '../subscriptions/subscription-topics';

/**
 * Main Mutation Resolver for GraphQL API
 * Handles all write operations with real-time notifications
 */
@Resolver()
export class MutationResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly coursesService: CoursesService,
    private readonly assessmentsService: AssessmentsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSubEngine,
  ) {}

  // User Mutations
  @Mutation(() => UserType)
  async createUser(@Args('input') input: CreateUserInput): Promise<UserType> {
    const user = await this.usersService.create(input);
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.USER_CREATED, { userCreated: user });
    return user;
  }

  @Mutation(() => UserType)
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserInput,
  ): Promise<UserType> {
    const user = await this.usersService.update(id, input);
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.USER_UPDATED, { userUpdated: user });
    return user;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteUser(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    const user = await this.usersService.findOne(id);
    await this.usersService.remove(id);
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.USER_DELETED, { userDeleted: user });
    return true;
  }

  // Course Mutations
  @Mutation(() => CourseType)
  @UseGuards(JwtAuthGuard)
  async createCourse(@Args('input') input: CreateCourseInput): Promise<CourseType> {
    const course = await this.coursesService.create(input);
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.COURSE_CREATED, { courseCreated: course });
    return course;
  }

  @Mutation(() => CourseType)
  @UseGuards(JwtAuthGuard)
  async updateCourse(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCourseInput,
  ): Promise<CourseType> {
    const course = await this.coursesService.update(id, input);
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.COURSE_UPDATED, { courseUpdated: course });
    return course;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteCourse(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    const course = await this.coursesService.findOne(id);
    await this.coursesService.remove(id);
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.COURSE_DELETED, { courseDeleted: course });
    return true;
  }

  // Assessment Mutations
  @Mutation(() => AssessmentType)
  @UseGuards(JwtAuthGuard)
  async createAssessment(@Args('input') input: CreateAssessmentInput): Promise<AssessmentType> {
    const assessment = await this.assessmentsService.create(input);
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.ASSESSMENT_CREATED, {
      assessmentCreated: assessment,
    });
    return assessment;
  }

  @Mutation(() => AssessmentType)
  @UseGuards(JwtAuthGuard)
  async updateAssessment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAssessmentInput,
  ): Promise<AssessmentType> {
    const assessment = await this.assessmentsService.update(id, input);
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.ASSESSMENT_UPDATED, {
      assessmentUpdated: assessment,
    });
    return assessment;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteAssessment(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    const assessment = await this.assessmentsService.findOne(id);
    await this.assessmentsService.remove(id);
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.ASSESSMENT_DELETED, {
      assessmentDeleted: assessment,
    });
    return true;
  }
}
