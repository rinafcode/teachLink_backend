import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentAttempt } from '../entities/assessment-attempt.entity';
import { CriterionGrade } from './entities/criterion-grade.entity';
import { FeedbackTemplate } from './entities/feedback-template.entity';
import { Rubric } from './entities/rubric.entity';
import { RubricCriterion } from './entities/rubric-criterion.entity';
import { RubricLevel } from './entities/rubric-level.entity';
import { SubmissionGrade } from './entities/submission-grade.entity';
import { FeedbackTemplatesService } from './feedback-templates.service';
import { GradingController } from './grading.controller';
import { GradingService } from './grading.service';
import { RubricsService } from './rubrics.service';

/**
 * Registers the rubric-based grading subsystem: rubric definitions,
 * submission grading (manual + automated), and reusable feedback
 * templates. Imported by `AssessmentsModule` so the existing
 * `/assessments` API surface and the new `/grading` API share the
 * same DB connection and entity registry.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rubric,
      RubricCriterion,
      RubricLevel,
      SubmissionGrade,
      CriterionGrade,
      FeedbackTemplate,
      AssessmentAttempt,
    ]),
  ],
  providers: [RubricsService, GradingService, FeedbackTemplatesService],
  controllers: [GradingController],
  exports: [RubricsService, GradingService, FeedbackTemplatesService],
})
export class GradingModule {}
