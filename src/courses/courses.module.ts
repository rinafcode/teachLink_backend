import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesService } from './courses.service';
import { EnrollmentsService } from './enrollments.service';
import { CoursesController } from './courses.controller';
import { EnrollmentsController } from './enrollments.controller';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { CourseReview } from './entities/course-review.entity';
import { CourseModule } from './entities/course-module.entity';
import { CachingModule } from '../caching/caching.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, Enrollment, CourseReview, CourseModule]),
    CachingModule,
  ],
  providers: [CoursesService, EnrollmentsService],
  controllers: [CoursesController, EnrollmentsController],
  exports: [CoursesService, EnrollmentsService],
})
export class CoursesModule {}
