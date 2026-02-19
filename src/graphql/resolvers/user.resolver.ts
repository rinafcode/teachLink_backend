import { Resolver, ResolveField, Parent, Context } from '@nestjs/graphql';
import { UserType } from '../types/user.type';
import { CourseType } from '../types/course.type';
import { CoursesService } from '../../courses/courses.service';

/**
 * Field Resolver for User type
 * Handles nested field resolution with DataLoader optimization
 */
@Resolver(() => UserType)
export class UserResolver {
  constructor(private readonly coursesService: CoursesService) {}

  @ResolveField(() => [CourseType])
  async courses(
    @Parent() user: UserType,
    @Context() context: any,
  ): Promise<CourseType[]> {
    const { coursesByInstructorLoader } = context.loaders || {};
    
    if (coursesByInstructorLoader) {
      return coursesByInstructorLoader.load(user.id);
    }
    
    return this.coursesService.findByInstructor(user.id);
  }
}
