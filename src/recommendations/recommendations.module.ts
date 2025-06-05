import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { UserPreferencesService } from './preferences/user-preferences.service';
import { ContentSimilarityService } from './similarity/content-similarity.service';
import { MLModelService } from './ml/ml-model.service';
import { UserPreference } from './entities/user-preference.entity';
import { CourseInteraction } from './entities/course-interaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserPreference, CourseInteraction])],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    UserPreferencesService,
    ContentSimilarityService,
    MLModelService,
  ],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
