import { TypeOrmModule } from "@nestjs/typeorm";
import { AssessmentsController } from "./assessment.controller";
import { AssessmentsService } from "./assessments.service";
import { Answer } from "./entities/answer.entity";
import { AssessmentAttempt } from "./entities/assessment-attempt.entity";
import { Assessment } from "./entities/assessment.entity";
import { Question } from "./entities/question.entity";
import { FeedbackGenerationService } from "./feedback/feedback-generation.service";
import { QuestionBankService } from "./questions/question-bank.service";
import { ScoreCalculationService } from "./scoring/score-calculation.service";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Assessment,
      Question,
      AssessmentAttempt,
      Answer,
    ]),
  ],
  controllers: [AssessmentsController],
  providers: [
    AssessmentsService,
    QuestionBankService,
    ScoreCalculationService,
    FeedbackGenerationService,
  ],
})
export class AssessmentsModule {}
