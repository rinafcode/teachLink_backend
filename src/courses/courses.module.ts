import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { CourseModule as CourseModuleEntity } from './entities/course-module.entity';
import { Enrollment } from './entities/enrollment.entity';
import { LocalizedCourseService } from './services/localized-course.service';
import { CurrencyModule } from '../currency/currency.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, CourseModuleEntity, Enrollment]),
    CurrencyModule,
    PaymentsModule,
  ],
  providers: [LocalizedCourseService],
  exports: [LocalizedCourseService],
})
export class CoursesModule {}
