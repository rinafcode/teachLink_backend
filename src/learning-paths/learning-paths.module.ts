import { Module } from '@nestjs/common';
import { LearningPathsController } from './learning-paths.controller';
import { LearningPathsService } from './learning-paths.service';
import { SkillAssessmentService } from './assessments/skill-assessment.service';
import { PathGenerationService } from './generation/path-generation.service';
import { MilestoneTrackingService } from './milestones/milestone-tracking.service';

@Module({
  controllers: [LearningPathsController],
  providers: [
    LearningPathsService,
    SkillAssessmentService,
    PathGenerationService,
    MilestoneTrackingService,
  ],
})
export class LearningPathsModule {}
