import { Resolver, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { UsersService } from '../../users/users.service';
import { CoursesService } from '../../courses/courses.service';
import { AssessmentsService } from '../../assessment/assessments.service';
import { UserType } from '../types/user.type';
import { CourseType } from '../types/course.type';
import { AssessmentType } from '../types/assessment.type';
import {
  CreateUserInput,
  UpdateUserInput,
} from '../inputs/user.input';
import {
  CreateCourseInput,
  UpdateCourseInput,
} from '../inputs/course.input';
import {
  CreateAssessmentInput,
  UpdateAssessmentInput,
} from '../inputs/assessment.input';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

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
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  // User Mutations
  @Mutation(() => UserType)
  async createUser(
    @Args('input') input: CreateUserInput,
  ): Promise<UserType> {
    const user = await this.usersService.create(input);
    await this.pubSub.publish('userCreated', { userCreated: user });
    return user;
  }

  @Mutation(() => UserType)
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserInput,
  ): Promise<UserType> {
    const user = await this.usersService.update(id, input);
    await this.pubSub.publish('userUpdated', { userUpdated: user });
    return user;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteUser(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.usersService.remove(id);
    await this.pubSub.publish('userDeleted', { userDeleted: { id } });
    return true;
  }

  // Course Mutations
  @Mutation(() => CourseType)
  @UseGuards(JwtAuthGuard)
  async createCourse(
    @Args('input') input: CreateCourseInput,
  ): Promise<CourseType> {
    const course = await this.coursesService.create(input);
    await this.pubSub.publish('courseCreated', { courseCreated: course });
    return course;
  }

  @Mutation(() => CourseType)
  @UseGuards(JwtAuthGuard)
  async updateCourse(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCourseInput,
  ): Promise<CourseType> {
    const course = await this.coursesService.update(id, input);
    await this.pubSub.publish('courseUpdated', { courseUpdated: course });
    return course;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteCourse(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.coursesService.remove(id);
    await this.pubSub.publish('courseDeleted', { courseDeleted: { id } });
    return true;
  }

  // Assessment Mutations
  @Mutation(() => AssessmentType)
  @UseGuards(JwtAuthGuard)
  async createAssessment(
    @Args('input') input: CreateAssessmentInput,
  ): Promise<AssessmentType> {
    const assessment = await this.assessmentsService.create(input);
    await this.pubSub.publish('assessmentCreated', {
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
    await this.pubSub.publish('assessmentUpdated', {
      assessmentUpdated: assessment,
    });
    return assessment;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteAssessment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.assessmentsService.remove(id);
    await this.pubSub.publish('assessmentDeleted', {
      assessmentDeleted: { id },
    });
    return true;
  }
}
