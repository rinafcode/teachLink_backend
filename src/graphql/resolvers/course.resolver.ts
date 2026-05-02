import { Resolver, ResolveField, Parent, Context } from '@nestjs/graphql';
import { CourseType } from '../types/course.type';
import { UserType } from '../types/user.type';
import { UsersService } from '../../users/users.service';
/**
 * Field Resolver for Course type
 * Handles nested field resolution with DataLoader optimization
 */
@Resolver(() => CourseType)
export class CourseResolver {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Executes instructor.
   * @param course The course.
   * @param context The context.
   * @returns The operation result.
   */
  @ResolveField(() => UserType, { nullable: true })
  async instructor(
    @Parent() course: CourseType,
    @Context() context: any,
  ): Promise<UserType | null> {
    if (!course.instructor) {
      return null;
    }
}
