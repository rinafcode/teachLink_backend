import { Injectable } from '@nestjs/common';
import { SkillAssessmentService } from './services/skill-assessment.service';
import { PathGenerationService } from './services/path-generation.service';
import { MilestoneTrackingService } from './services/milestone-tracking.service';

@Injectable()
export class LearningPathsService {
  constructor(
    private readonly skillAssessmentService: SkillAssessmentService,
    private readonly pathGenerationService: PathGenerationService,
    private readonly milestoneTrackingService: MilestoneTrackingService,
  ) {}

  generateLearningPath(input: any) {
    const assessment = this.skillAssessmentService.assess(input);
    const path = this.pathGenerationService.generate(assessment);
    return this.milestoneTrackingService.initialize(path);
  }
}
