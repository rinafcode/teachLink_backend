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

  @ResolveField(() => UserType, { nullable: true })
  async instructor(
    @Parent() course: CourseType,
    @Context() context: any,
  ): Promise<UserType | null> {
    if (!course.instructor) {
      return null;
    }

    const { userLoader } = context.loaders || {};
    
    // If instructor is already loaded with full data, return it
    if (typeof course.instructor === 'object' && course.instructor.id) {
      return course.instructor;
    }

    // Otherwise, use DataLoader to fetch instructor
    const instructorId = typeof course.instructor === 'string' 
      ? course.instructor 
      : course.instructor.id;

    if (userLoader) {
      return userLoader.load(instructorId);
    }
    
    return this.usersService.findOne(instructorId);
  }
}
