import { Injectable } from "@nestjs/common"
import type { AssessmentResult } from "../entities/assessment-result.entity"
import type { AssessmentAttempt } from "../entities/assessment-attempt.entity"
import { type Question, QuestionType, QuestionDifficulty } from "../entities/question.entity"

interface FeedbackReport {
  overallFeedback: string
  strengths: string[]
  areasForImprovement: string[]
  recommendations: string[]
  detailedResults: QuestionFeedback[]
}

interface QuestionFeedback {
  questionId: string
  questionText: string
  userAnswer: any
  correctAnswer: any
  isCorrect: boolean
  feedback: string
  difficulty: QuestionDifficulty
  type: QuestionType
}

@Injectable()
export class FeedbackGenerationService {
  async generateComprehensiveFeedback(
    attempt: AssessmentAttempt,
    results: AssessmentResult[],
  ): Promise<FeedbackReport> {
    const detailedResults = await this.generateQuestionFeedback(results)
    const overallFeedback = this.generateOverallFeedback(attempt, results)
    const strengths = this.identifyStrengths(results)
    const areasForImprovement = this.identifyWeaknesses(results)
    const recommendations = this.generateRecommendations(results, attempt)

    return {
      overallFeedback,
      strengths,
      areasForImprovement,
      recommendations,
      detailedResults,
    }
  }

  private async generateQuestionFeedback(results: AssessmentResult[]): Promise<QuestionFeedback[]> {
    return results.map((result) => ({
      questionId: result.questionId,
      questionText: result.question.questionText,
      userAnswer: result.userAnswer,
      correctAnswer: result.correctAnswer,
      isCorrect: result.isCorrect,
      feedback: result.feedback || this.generateQuestionSpecificFeedback(result),
      difficulty: result.question.difficulty,
      type: result.question.type,
    }))
  }

  private generateQuestionSpecificFeedback(result: AssessmentResult): string {
    const { question, isCorrect, userAnswer } = result

    if (isCorrect) {
      return this.generatePositiveFeedback(question.type, question.difficulty)
    }

    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
        return this.generateMultipleChoiceFeedback(question, userAnswer)

      case QuestionType.TRUE_FALSE:
        return this.generateTrueFalseFeedback(question, userAnswer)

      case QuestionType.SHORT_ANSWER:
        return this.generateShortAnswerFeedback(question, userAnswer)

      case QuestionType.CODING_CHALLENGE:
        return this.generateCodingFeedback(question, userAnswer)

      default:
        return "Please review this question with your instructor."
    }
  }

  private generatePositiveFeedback(type: QuestionType, difficulty: QuestionDifficulty): string {
    const difficultyPhrases = {
      [QuestionDifficulty.EASY]: "Great job!",
      [QuestionDifficulty.MEDIUM]: "Well done!",
      [QuestionDifficulty.HARD]: "Excellent work!",
    }

    const typePhrases = {
      [QuestionType.MULTIPLE_CHOICE]: "You selected the correct answer.",
      [QuestionType.TRUE_FALSE]: "You identified the correct statement.",
      [QuestionType.SHORT_ANSWER]: "Your answer demonstrates good understanding.",
      [QuestionType.CODING_CHALLENGE]: "Your code solution is correct!",
    }

    return `${difficultyPhrases[difficulty]} ${typePhrases[type]}`
  }

  private generateMultipleChoiceFeedback(question: Question, userAnswer: string): string {
    const correctOption = question.options.find((opt) => opt.isCorrect)
    const selectedOption = question.options.find((opt) => opt.id === userAnswer)

    let feedback = `The correct answer is: ${correctOption?.optionText}. `

    if (selectedOption) {
      feedback += `You selected: ${selectedOption.optionText}. `
      if (selectedOption.explanation) {
        feedback += selectedOption.explanation
      }
    }

    if (question.explanation) {
      feedback += ` ${question.explanation}`
    }

    return feedback
  }

  private generateTrueFalseFeedback(question: Question, userAnswer: boolean): string {
    const correctOption = question.options.find((opt) => opt.isCorrect)
    const correctAnswer = correctOption?.optionText.toLowerCase() === "true"

    let feedback = `The correct answer is: ${correctAnswer}. `
    feedback += `You answered: ${userAnswer}. `

    if (question.explanation) {
      feedback += question.explanation
    }

    return feedback
  }

  private generateShortAnswerFeedback(question: Question, userAnswer: string): string {
    let feedback = "Your answer requires further review. "

    if (question.metadata?.sampleAnswers) {
      feedback += `Consider these key points: ${question.metadata.sampleAnswers.join(", ")}. `
    }

    if (question.explanation) {
      feedback += question.explanation
    }

    return feedback
  }

  private generateCodingFeedback(question: Question, userAnswer: string): string {
    let feedback = "Your code needs improvement. "

    if (question.metadata?.hints) {
      feedback += `Hints: ${question.metadata.hints.join(", ")}. `
    }

    if (question.explanation) {
      feedback += question.explanation
    }

    return feedback
  }

  private generateOverallFeedback(attempt: AssessmentAttempt, results: AssessmentResult[]): string {
    const { score, percentage, passed } = attempt
    const totalQuestions = results.length
    const correctAnswers = results.filter((r) => r.isCorrect).length

    let feedback = `You completed the assessment with a score of ${score} points (${percentage?.toFixed(1)}%). `
    feedback += `You answered ${correctAnswers} out of ${totalQuestions} questions correctly. `

    if (passed) {
      feedback += "Congratulations! You have passed this assessment. "
    } else {
      feedback += "You did not meet the passing criteria. Please review the material and try again. "
    }

    if (attempt.timeSpent) {
      const minutes = Math.floor(attempt.timeSpent / 60)
      const seconds = attempt.timeSpent % 60
      feedback += `Time taken: ${minutes}m ${seconds}s. `
    }

    return feedback
  }

  private identifyStrengths(results: AssessmentResult[]): string[] {
    const strengths: string[] = []
    const correctByType = this.groupResultsByType(results.filter((r) => r.isCorrect))
    const correctByDifficulty = this.groupResultsByDifficulty(results.filter((r) => r.isCorrect))

    // Identify strong question types
    Object.entries(correctByType).forEach(([type, count]) => {
      const totalOfType = results.filter((r) => r.question.type === type).length
      if (count / totalOfType >= 0.8) {
        strengths.push(`Strong performance in ${type.replace("_", " ")} questions`)
      }
    })

    // Identify strong difficulty levels
    Object.entries(correctByDifficulty).forEach(([difficulty, count]) => {
      const totalOfDifficulty = results.filter((r) => r.question.difficulty === difficulty).length
      if (count / totalOfDifficulty >= 0.8) {
        strengths.push(`Excellent handling of ${difficulty} level questions`)
      }
    })

    return strengths.length > 0 ? strengths : ["Keep practicing to build your strengths!"]
  }

  private identifyWeaknesses(results: AssessmentResult[]): string[] {
    const weaknesses: string[] = []
    const incorrectByType = this.groupResultsByType(results.filter((r) => !r.isCorrect))
    const incorrectByDifficulty = this.groupResultsByDifficulty(results.filter((r) => !r.isCorrect))

    // Identify weak question types
    Object.entries(incorrectByType).forEach(([type, count]) => {
      const totalOfType = results.filter((r) => r.question.type === type).length
      if (count / totalOfType >= 0.5) {
        weaknesses.push(`Need improvement in ${type.replace("_", " ")} questions`)
      }
    })

    // Identify weak difficulty levels
    Object.entries(incorrectByDifficulty).forEach(([difficulty, count]) => {
      const totalOfDifficulty = results.filter((r) => r.question.difficulty === difficulty).length
      if (count / totalOfDifficulty >= 0.5) {
        weaknesses.push(`Focus on ${difficulty} level concepts`)
      }
    })

    return weaknesses
  }

  private generateRecommendations(results: AssessmentResult[], attempt: AssessmentAttempt): string[] {
    const recommendations: string[] = []
    const incorrectResults = results.filter((r) => !r.isCorrect)

    if (attempt.percentage < 60) {
      recommendations.push("Review the fundamental concepts before retaking the assessment")
      recommendations.push("Consider seeking additional help from your instructor")
    } else if (attempt.percentage < 80) {
      recommendations.push("Focus on the specific topics where you made mistakes")
      recommendations.push("Practice similar questions to reinforce your understanding")
    }

    // Time-based recommendations
    if (attempt.timeSpent && attempt.assessment.timeLimit) {
      const timeRatio = attempt.timeSpent / (attempt.assessment.timeLimit * 60)
      if (timeRatio > 0.9) {
        recommendations.push("Work on improving your speed and time management")
      } else if (timeRatio < 0.5) {
        recommendations.push("Take more time to carefully read and analyze each question")
      }
    }

    // Type-specific recommendations
    const codingErrors = incorrectResults.filter((r) => r.question.type === QuestionType.CODING_CHALLENGE)
    if (codingErrors.length > 0) {
      recommendations.push("Practice more coding exercises and review programming fundamentals")
    }

    return recommendations.length > 0 ? recommendations : ["Keep up the good work!"]
  }

  private groupResultsByType(results: AssessmentResult[]): Record<string, number> {
    return results.reduce(
      (acc, result) => {
        const type = result.question.type
        acc[type] = (acc[type] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
  }

  private groupResultsByDifficulty(results: AssessmentResult[]): Record<string, number> {
    return results.reduce(
      (acc, result) => {
        const difficulty = result.question.difficulty
        acc[difficulty] = (acc[difficulty] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
  }
}
