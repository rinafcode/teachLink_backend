import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assessment } from './entities/assessment.entity';
import { Question } from './entities/question.entity';
import { QuestionOption } from './entities/question-option.entity';
import { AssessmentAttempt } from './entities/assessment-attempt.entity';
import { AssessmentResult } from './entities/assessment-result.entity';
import { AssessmentsController } from './controllers/assessments.controller';
import { AssessmentsService } from './providers/assessments.service';
import { QuestionBankService } from './providers/question-bank.service';
import { ScoreCalculationService } from './providers/score-calculation.service';
import { FeedbackGenerationService } from './providers/feedback-generation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Assessment,
      Question,
      QuestionOption,
      AssessmentAttempt,
      AssessmentResult,
    ]),
  ],
  controllers: [AssessmentsController],
  providers: [
    AssessmentsService,
    QuestionBankService,
    ScoreCalculationService,
    FeedbackGenerationService,
  ],
  exports: [
    AssessmentsService,
    QuestionBankService,
    ScoreCalculationService,
    FeedbackGenerationService,
  ],
})
export class AssessmentsModule {}
