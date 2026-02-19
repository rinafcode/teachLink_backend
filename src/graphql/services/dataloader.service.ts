import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { UsersService } from '../../users/users.service';
import { CoursesService } from '../../courses/courses.service';
import { AssessmentsService } from '../../assessment/assessments.service';
import { User } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';
import { Assessment } from '../../assessment/entities/assessment.entity';

/**
 * DataLoader service to prevent N+1 query problems
 * Batches and caches database requests within a single GraphQL request
 */
@Injectable()
export class DataLoaderService {
  constructor(
    private readonly usersService: UsersService,
    private readonly coursesService: CoursesService,
    private readonly assessmentsService: AssessmentsService,
  ) {}

  /**
   * Create a new DataLoader for batching user queries by ID
   */
  createUserLoader(): DataLoader<string, User> {
    return new DataLoader<string, User>(async (userIds: readonly string[]) => {
      const users = await this.usersService.findByIds(Array.from(userIds));
      const userMap = new Map(users.map((user) => [user.id, user]));
      return userIds.map((id) => userMap.get(id) || null);
    });
  }

  /**
   * Create a new DataLoader for batching course queries by ID
   */
  createCourseLoader(): DataLoader<string, Course> {
    return new DataLoader<string, Course>(
      async (courseIds: readonly string[]) => {
        const courses = await this.coursesService.findByIds(
          Array.from(courseIds),
        );
        const courseMap = new Map(courses.map((course) => [course.id, course]));
        return courseIds.map((id) => courseMap.get(id) || null);
      },
    );
  }

  /**
   * Create a new DataLoader for batching assessment queries by ID
   */
  createAssessmentLoader(): DataLoader<string, Assessment> {
    return new DataLoader<string, Assessment>(
      async (assessmentIds: readonly string[]) => {
        const assessments = await this.assessmentsService.findByIds(
          Array.from(assessmentIds),
        );
        const assessmentMap = new Map(
          assessments.map((assessment) => [assessment.id, assessment]),
        );
        return assessmentIds.map((id) => assessmentMap.get(id) || null);
      },
    );
  }

  /**
   * Create a new DataLoader for batching courses by instructor ID
   */
  createCoursesByInstructorLoader(): DataLoader<string, Course[]> {
    return new DataLoader<string, Course[]>(
      async (instructorIds: readonly string[]) => {
        const courses =
          await this.coursesService.findByInstructorIds(
            Array.from(instructorIds),
          );

        const coursesByInstructor = new Map<string, Course[]>();
        courses.forEach((course) => {
          const instructorId = course.instructor?.id;
          if (instructorId) {
            if (!coursesByInstructor.has(instructorId)) {
              coursesByInstructor.set(instructorId, []);
            }
            coursesByInstructor.get(instructorId).push(course);
          }
        });

        return instructorIds.map(
          (id) => coursesByInstructor.get(id) || [],
        );
      },
    );
  }

  /**
   * Create all loaders for a GraphQL request context
   */
  createLoaders() {
    return {
      userLoader: this.createUserLoader(),
      courseLoader: this.createCourseLoader(),
      assessmentLoader: this.createAssessmentLoader(),
      coursesByInstructorLoader: this.createCoursesByInstructorLoader(),
    };
  }
}
