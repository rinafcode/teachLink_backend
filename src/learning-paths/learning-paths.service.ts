import { Injectable } from '@nestjs/common';
import { SkillAssessmentService } from './assessments/skill-assessment.service';
import { PathGenerationService } from './generation/path-generation.service';
import { MilestoneTrackingService } from './milestones/milestone-tracking.service';
import { CreateLearningPathDto } from './dto/create-learning-path.dto';

@Injectable()
export class LearningPathsService {
  constructor(
    private readonly assessmentService: SkillAssessmentService,
    private readonly generationService: PathGenerationService,
    private readonly milestoneService: MilestoneTrackingService,
  ) {}

  async createPath(dto: CreateLearningPathDto) {
    const assessmentResult = await this.assessmentService.evaluate(
      dto.userId,
      dto.answers,
    );
    const path = await this.generationService.generate(
      dto.goal,
      assessmentResult,
    );
    await this.milestoneService.initializeMilestones(dto.userId, path);
    return path;
  }

  async getPathForUser(userId: string) {
    return {
      userId,
      path: [],
    };
  }
}
