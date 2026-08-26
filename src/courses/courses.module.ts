import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesService } from './courses.service';
import { EnrollmentsService } from './enrollments.service';
import { CoursesController } from './courses.controller';
import { EnrollmentsController } from './enrollments.controller';
import { Course } from './entities/course.entity';
import { Enrollment } from './entities/enrollment.entity';
import { CourseReview } from './entities/course-review.entity';
import { CourseModule } from './entities/course-module.entity';
import { BulkOperation } from './entities/bulk-operation.entity';
import { CachingModule } from '../caching/caching.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { OutboxModule } from '../common/events/outbox.module';

import { PaginationService } from '../common/services/pagination.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, Enrollment, CourseReview, CourseModule, BulkOperation]),
    CachingModule,
    forwardRef(() => AnalyticsModule),
    OutboxModule,
  ],
  providers: [CoursesService, EnrollmentsService, PaginationService],
  controllers: [CoursesController, EnrollmentsController],
  exports: [CoursesService, EnrollmentsService],
})
export class CoursesModule {}
