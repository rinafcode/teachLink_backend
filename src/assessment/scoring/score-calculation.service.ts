import { Injectable } from "@nestjs/common";
import { Question } from "../entities/question.entity";
import { QuestionType } from "../enums/question-type.enum";

@Injectable()
export class ScoreCalculationService {
  calculate(question: Question, response: any): number {
    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
      case QuestionType.TRUE_FALSE:
        return response === question.correctAnswer
          ? question.points
          : 0;

      case QuestionType.CODING:
        // Placeholder (extend with judge later)
        return response?.passed ? question.points : 0;

      default:
        return 0;
    }
  }
}
