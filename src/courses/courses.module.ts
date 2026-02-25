import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { ModulesService } from './modules/modules.service';
import { LessonsService } from './lessons/lessons.service';
import { EnrollmentsService } from './enrollments/enrollments.service';
import { Course } from './entities/course.entity';
import { CourseModule as CourseModuleEntity } from './entities/course-module.entity';
import { Lesson } from './entities/lesson.entity';
import { Enrollment } from './entities/enrollment.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, CourseModuleEntity, Lesson, Enrollment, User]),
  ],
  controllers: [CoursesController],
  providers: [CoursesService, ModulesService, LessonsService, EnrollmentsService],
  exports: [CoursesService],
})
export class CoursesModule {}
