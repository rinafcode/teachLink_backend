import { Injectable } from '@nestjs/common';
import { Question } from '../entities/question.entity';
import { QuestionType } from '../enums/question-type.enum';

/**
 * Provides score Calculation operations.
 */
@Injectable()
export class ScoreCalculationService {
  /**
   * Calculates calculate.
   * @param question The question.
   * @param response The response.
   * @returns The calculated numeric value.
   */
  calculate(question: Question, response: any): number {
    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
      case QuestionType.TRUE_FALSE:
        return response === question.correctAnswer ? question.points : 0;

      case QuestionType.CODING:
        // Placeholder (extend with judge later)
        return response?.passed ? question.points : 0;

      default:
        return 0;
    }
}
