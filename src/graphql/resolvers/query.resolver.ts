import { IPaginatedResponse } from '../../common/utils/pagination.util';
import { Resolver, Query, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { CoursesService } from '../../courses/courses.service';
import { AssessmentsService } from '../../assessment/assessments.service';
import { UserType } from '../types/user.type';
import { CourseType } from '../types/course.type';
import { AssessmentType } from '../types/assessment.type';
import { UserFilterInput } from '../inputs/user.input';
import { CourseFilterInput } from '../inputs/course.input';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
/**
 * Main Query Resolver for GraphQL API
 * Handles all read operations with optimized data fetching
 */
@Resolver()
export class QueryResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly coursesService: CoursesService,
    private readonly assessmentsService: AssessmentsService,
  ) {}

  // User Queries
  /**
   * Executes user.
   * @param id The identifier.
   * @param context The context.
   * @returns The resulting user type.
   */
  @Query(() => UserType, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async user(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: any,
  ): Promise<UserType> {
    const { userLoader } = context.loaders || {};
    if (userLoader) {
      return userLoader.load(id);
    }
    return this.usersService.findOne(id);
  }

  /**
   * Executes users.
   * @param filter The filter criteria.
   * @returns The resulting paginated response<user type>.
   */
  @Query(() => [UserType])
  @UseGuards(JwtAuthGuard)
  async users(
    @Args('filter', { type: () => UserFilterInput, nullable: true })
    filter?: UserFilterInput,
  ): Promise<IPaginatedResponse<UserType>> {
    return this.usersService.findAll(filter);
  }

  /**
   * Executes me.
   * @param context The context.
   * @returns The resulting user type.
   */
  @Query(() => UserType)
  @UseGuards(JwtAuthGuard)
  async me(@Context() context: any): Promise<UserType> {
    const userId = context.req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.usersService.findOne(userId);
  }

  // Course Queries
  /**
   * Executes course.
   * @param id The identifier.
   * @param context The context.
   * @returns The resulting course type.
   */
  @Query(() => CourseType, { nullable: true })
  async course(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: any,
  ): Promise<CourseType> {
    const { courseLoader } = context.loaders || {};
    if (courseLoader) {
      return courseLoader.load(id);
    }
    return this.coursesService.findOne(id);
  }

  /**
   * Executes courses.
   * @param filter The filter criteria.
   * @returns The resulting paginated response<course type>.
   */
  @Query(() => [CourseType])
  async courses(
    @Args('filter', { type: () => CourseFilterInput, nullable: true })
    filter?: CourseFilterInput,
  ): Promise<IPaginatedResponse<CourseType>> {
    return this.coursesService.findAll(filter);
  }

  /**
   * Executes my Courses.
   * @param context The context.
   * @returns The matching results.
   */
  @Query(() => [CourseType])
  @UseGuards(JwtAuthGuard)
  async myCourses(@Context() context: any): Promise<CourseType[]> {
    const userId = context.req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.coursesService.findByInstructor(userId);
  }

  // Assessment Queries
  /**
   * Executes assessment.
   * @param id The identifier.
   * @param context The context.
   * @returns The resulting assessment type.
   */
  @Query(() => AssessmentType, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async assessment(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: any,
  ): Promise<AssessmentType> {
    const { assessmentLoader } = context.loaders || {};
    if (assessmentLoader) {
      return assessmentLoader.load(id);
    }
    return this.assessmentsService.findOne(id);
  }

  /**
   * Executes assessments.
   * @returns The matching results.
   */
  @Query(() => [AssessmentType])
  @UseGuards(JwtAuthGuard)
  async assessments(): Promise<AssessmentType[]> {
    return this.assessmentsService.findAll();
  }
}
