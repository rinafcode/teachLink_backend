import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course } from './entities/course.entity';
import { CourseReview } from './entities/course-review.entity';
import { CourseVersion } from './entities/course-version.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Course, CourseReview, CourseVersion])],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
