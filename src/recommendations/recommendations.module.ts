import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { CachingModule } from '../caching/caching.module';
import { RecommendationEngineService } from './recommendation-engine.service';
import { CollaborativeFilteringService } from './collaborative-filtering.service';
import { ContentBasedFilteringService } from './content-based-filtering.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Course, Enrollment]), CachingModule],
  providers: [
    RecommendationEngineService,
    CollaborativeFilteringService,
    ContentBasedFilteringService,
  ],
  controllers: [RecommendationsController],
  exports: [RecommendationEngineService],
})
export class RecommendationsModule {}
