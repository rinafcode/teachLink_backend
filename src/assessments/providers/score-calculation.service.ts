import { Injectable } from '@nestjs/common';
import { type Question, QuestionType } from '../entities/question.entity';
import type { AssessmentResult } from '../entities/assessment-result.entity';

interface ScoringResult {
  isCorrect: boolean;
  pointsEarned: number;
  pointsPossible: number;
  feedback?: string;
}

@Injectable()
export class ScoreCalculationService {
  async calculateQuestionScore(
    question: Question,
    userAnswer: any,
    timeSpent?: number,
  ): Promise<ScoringResult> {
    const pointsPossible = question.points;

    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
        return this.scoreMultipleChoice(question, userAnswer, pointsPossible);

      case QuestionType.TRUE_FALSE:
        return this.scoreTrueFalse(question, userAnswer, pointsPossible);

      case QuestionType.SHORT_ANSWER:
        return this.scoreShortAnswer(question, userAnswer, pointsPossible);

      case QuestionType.CODING_CHALLENGE:
        return this.scoreCodingChallenge(question, userAnswer, pointsPossible);

      default:
        return {
          isCorrect: false,
          pointsEarned: 0,
          pointsPossible,
          feedback: 'Unknown question type',
        };
    }
  }

  private scoreMultipleChoice(
    question: Question,
    userAnswer: string,
    pointsPossible: number,
  ): ScoringResult {
    const correctOption = question.options.find((option) => option.isCorrect);
    const selectedOption = question.options.find(
      (option) => option.id === userAnswer,
    );

    const isCorrect =
      correctOption && selectedOption && correctOption.id === selectedOption.id;

    return {
      isCorrect,
      pointsEarned: isCorrect ? pointsPossible : 0,
      pointsPossible,
      feedback: isCorrect
        ? 'Correct!'
        : `Incorrect. The correct answer is: ${correctOption?.optionText}`,
    };
  }

  private scoreTrueFalse(
    question: Question,
    userAnswer: boolean,
    pointsPossible: number,
  ): ScoringResult {
    const correctOption = question.options.find((option) => option.isCorrect);
    const correctAnswer = correctOption?.optionText.toLowerCase() === 'true';

    const isCorrect = userAnswer === correctAnswer;

    return {
      isCorrect,
      pointsEarned: isCorrect ? pointsPossible : 0,
      pointsPossible,
      feedback: isCorrect
        ? 'Correct!'
        : `Incorrect. The correct answer is: ${correctAnswer}`,
    };
  }

  private scoreShortAnswer(
    question: Question,
    userAnswer: string,
    pointsPossible: number,
  ): ScoringResult {
    // For short answers, we'll implement basic keyword matching
    // In a real system, this might use NLP or require manual grading
    const correctAnswers = question.metadata?.correctAnswers || [];
    const userAnswerLower = userAnswer.toLowerCase().trim();

    const isCorrect = correctAnswers.some((correct: string) =>
      userAnswerLower.includes(correct.toLowerCase()),
    );

    return {
      isCorrect,
      pointsEarned: isCorrect ? pointsPossible : 0,
      pointsPossible,
      feedback: isCorrect
        ? 'Correct!'
        : 'Your answer needs review. Please check with your instructor.',
    };
  }

  private async scoreCodingChallenge(
    question: Question,
    userAnswer: string,
    pointsPossible: number,
  ): Promise<ScoringResult> {
    // For coding challenges, we'll implement basic test case execution
    // In a real system, this would use a secure code execution environment
    const testCases = question.metadata?.testCases || [];
    let passedTests = 0;

    try {
      // This is a simplified example - in production, use a secure sandbox
      for (const testCase of testCases) {
        const result = this.executeCode(userAnswer, testCase.input);
        if (result === testCase.expectedOutput) {
          passedTests++;
        }
      }

      const isCorrect = passedTests === testCases.length;
      const partialCredit =
        testCases.length > 0 ? passedTests / testCases.length : 0;

      return {
        isCorrect,
        pointsEarned: pointsPossible * partialCredit,
        pointsPossible,
        feedback: `Passed ${passedTests}/${testCases.length} test cases`,
      };
    } catch (error) {
      return {
        isCorrect: false,
        pointsEarned: 0,
        pointsPossible,
        feedback: `Code execution error: ${error.message}`,
      };
    }
  }

  private executeCode(code: string, input: any): any {
    // WARNING: This is a simplified example for demonstration
    // In production, use a secure sandboxed environment like Docker
    try {
      // Create a function from the user's code
      const func = new Function(
        'input',
        `
        ${code}
        return typeof solution === 'function' ? solution(input) : undefined;
      `,
      );

      return func(input);
    } catch (error) {
      throw new Error(`Execution failed: ${error.message}`);
    }
  }

  async calculateAssessmentScore(results: AssessmentResult[]): Promise<{
    totalScore: number;
    totalPossible: number;
    percentage: number;
    passed: boolean;
    passingScore: number;
  }> {
    const totalScore = results.reduce(
      (sum, result) => sum + result.pointsEarned,
      0,
    );
    const totalPossible = results.reduce(
      (sum, result) => sum + result.pointsPossible,
      0,
    );
    const percentage =
      totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;

    // Default passing score of 70%
    const passingScore = 70;
    const passed = percentage >= passingScore;

    return {
      totalScore,
      totalPossible,
      percentage,
      passed,
      passingScore,
    };
  }

  async calculateTimeBonus(
    timeSpent: number,
    timeLimit: number,
  ): Promise<number> {
    if (!timeLimit || timeSpent >= timeLimit * 60) {
      return 0;
    }

    // Award up to 10% bonus for completing early
    const timeRatio = timeSpent / (timeLimit * 60);
    const bonus = Math.max(0, (1 - timeRatio) * 0.1);

    return bonus;
  }
}
