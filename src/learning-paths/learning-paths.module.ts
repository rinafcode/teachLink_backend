import { Module } from '@nestjs/common';
import { LearningPathsController } from './learning-paths.controller';
import { LearningPathsService } from './learning-paths.service';
import { SkillAssessmentService } from './services/skill-assessment.service';
import { PathGenerationService } from './services/path-generation.service';
import { MilestoneTrackingService } from './services/milestone-tracking.service';

@Module({
  controllers: [LearningPathsController],
  providers: [
    LearningPathsService,
    SkillAssessmentService,
    PathGenerationService,
    MilestoneTrackingService,
  ],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
