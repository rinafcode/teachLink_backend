import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { QuestionBankService } from "./question-bank.service"
import { ScoreCalculationService } from "./score-calculation.service"
import { FeedbackGenerationService } from "./feedback-generation.service"
import { Assessment, AssessmentStatus } from "../entities/assessment.entity"
import { AssessmentAttempt, AttemptStatus } from "../entities/assessment-attempt.entity"
import { AssessmentResult } from "../entities/assessment-result.entity"
import { CreateAssessmentDto } from "../dto/create-assessment.dto"
import { StartAssessmentDto } from "../dto/start-assessment.dto"
import { SubmitAssessmentDto } from "../dto/submit-assessment.dto"

@Injectable()
export class AssessmentsService {
  constructor(
    private questionBankService: QuestionBankService,
    private scoreCalculationService: ScoreCalculationService,
    private feedbackGenerationService: FeedbackGenerationService,
    @InjectRepository(Assessment)
    private assessmentRepository: Repository<Assessment>,
    @InjectRepository(AssessmentAttempt)
    private attemptRepository: Repository<AssessmentAttempt>,
    @InjectRepository(AssessmentResult)
    private resultRepository: Repository<AssessmentResult>,
  ) {}

  async createAssessment(createAssessmentDto: CreateAssessmentDto, createdBy: string): Promise<Assessment> {
    const assessment = this.assessmentRepository.create({
      ...createAssessmentDto,
      createdBy,
      availableFrom: createAssessmentDto.availableFrom ? new Date(createAssessmentDto.availableFrom) : null,
      availableUntil: createAssessmentDto.availableUntil ? new Date(createAssessmentDto.availableUntil) : null,
    })

    const savedAssessment = await this.assessmentRepository.save(assessment)

    // Create questions if provided
    if (createAssessmentDto.questions && createAssessmentDto.questions.length > 0) {
      for (const questionDto of createAssessmentDto.questions) {
        await this.questionBankService.createQuestion(savedAssessment.id, questionDto)
      }
    }

    return this.findAssessmentById(savedAssessment.id)
  }

  async findAssessmentById(id: string): Promise<Assessment> {
    const assessment = await this.assessmentRepository.findOne({
      where: { id },
      relations: ["questions", "questions.options", "creator"],
    })

    if (!assessment) {
      throw new NotFoundException(`Assessment with ID ${id} not found`)
    }

    return assessment
  }

  async findAllAssessments(courseId?: string): Promise<Assessment[]> {
    const where = courseId ? { courseId, status: AssessmentStatus.PUBLISHED } : { status: AssessmentStatus.PUBLISHED }

    return this.assessmentRepository.find({
      where,
      relations: ["creator"],
      order: { createdAt: "DESC" },
    })
  }

  async startAssessment(startAssessmentDto: StartAssessmentDto, userId: string): Promise<AssessmentAttempt> {
    const assessment = await this.findAssessmentById(startAssessmentDto.assessmentId)

    // Validate assessment availability
    await this.validateAssessmentAvailability(assessment, userId)

    // Check if user has remaining attempts
    const existingAttempts = await this.attemptRepository.count({
      where: { assessmentId: assessment.id, userId },
    })

    if (existingAttempts >= assessment.maxAttempts) {
      throw new BadRequestException("Maximum number of attempts reached")
    }

    // Check for existing in-progress attempt
    const inProgressAttempt = await this.attemptRepository.findOne({
      where: {
        assessmentId: assessment.id,
        userId,
        status: AttemptStatus.IN_PROGRESS,
      },
    })

    if (inProgressAttempt) {
      return inProgressAttempt
    }

    // Create new attempt
    const attempt = this.attemptRepository.create({
      assessmentId: assessment.id,
      userId,
      attemptNumber: existingAttempts + 1,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
      answers: {},
    })

    return this.attemptRepository.save(attempt)
  }

  async submitAssessment(submitAssessmentDto: SubmitAssessmentDto, userId: string): Promise<AssessmentAttempt> {
    const attempt = await this.attemptRepository.findOne({
      where: { id: submitAssessmentDto.attemptId, userId },
      relations: ["assessment", "assessment.questions", "assessment.questions.options"],
    })

    if (!attempt) {
      throw new NotFoundException("Assessment attempt not found")
    }

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException("Assessment attempt is not in progress")
    }

    // Check time limit
    if (attempt.assessment.timeLimit && attempt.startedAt) {
      const timeElapsed = (Date.now() - attempt.startedAt.getTime()) / 1000
      const timeLimit = attempt.assessment.timeLimit * 60

      if (timeElapsed > timeLimit) {
        attempt.status = AttemptStatus.TIME_EXPIRED
        await this.attemptRepository.save(attempt)
        throw new BadRequestException("Time limit exceeded")
      }

      attempt.timeSpent = Math.floor(timeElapsed)
    }

    // Process answers and calculate scores
    const results = await this.processAnswers(attempt, submitAssessmentDto.answers)

    // Calculate final score
    const scoreData = await this.scoreCalculationService.calculateAssessmentScore(results)

    // Update attempt
    attempt.status = AttemptStatus.COMPLETED
    attempt.completedAt = new Date()
    attempt.answers = submitAssessmentDto.answers
    attempt.score = scoreData.totalScore
    attempt.percentage = scoreData.percentage
    attempt.passed = scoreData.percentage >= attempt.assessment.passingScore

    await this.attemptRepository.save(attempt)

    return attempt
  }

  async getAssessmentResults(attemptId: string, userId: string): Promise<any> {
    const attempt = await this.attemptRepository.findOne({
      where: { id: attemptId, userId },
      relations: ["assessment", "results", "results.question", "results.question.options"],
    })

    if (!attempt) {
      throw new NotFoundException("Assessment attempt not found")
    }

    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException("Assessment is still in progress")
    }

    // Generate comprehensive feedback
    const feedback = await this.feedbackGenerationService.generateComprehensiveFeedback(attempt, attempt.results)

    return {
      attempt,
      feedback,
    }
  }

  async getUserAttempts(userId: string, assessmentId?: string): Promise<AssessmentAttempt[]> {
    const where = assessmentId ? { userId, assessmentId } : { userId }

    return this.attemptRepository.find({
      where,
      relations: ["assessment"],
      order: { createdAt: "DESC" },
    })
  }

  async getAssessmentStatistics(assessmentId: string): Promise<any> {
    const attempts = await this.attemptRepository.find({
      where: { assessmentId, status: AttemptStatus.COMPLETED },
    })

    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
        averageTimeSpent: 0,
      }
    }

    const totalAttempts = attempts.length
    const averageScore = attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / totalAttempts
    const passedAttempts = attempts.filter((attempt) => attempt.passed).length
    const passRate = (passedAttempts / totalAttempts) * 100
    const averageTimeSpent = attempts.reduce((sum, attempt) => sum + (attempt.timeSpent || 0), 0) / totalAttempts

    return {
      totalAttempts,
      averageScore: Math.round(averageScore * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      averageTimeSpent: Math.round(averageTimeSpent),
    }
  }

  async updateAssessmentStatus(id: string, status: AssessmentStatus, userId: string): Promise<Assessment> {
    const assessment = await this.findAssessmentById(id)

    if (assessment.createdBy !== userId) {
      throw new ForbiddenException("You can only update your own assessments")
    }

    assessment.status = status
    return this.assessmentRepository.save(assessment)
  }

  private async validateAssessmentAvailability(assessment: Assessment, userId: string): Promise<void> {
    if (assessment.status !== AssessmentStatus.PUBLISHED) {
      throw new BadRequestException("Assessment is not available")
    }

    const now = new Date()

    if (assessment.availableFrom && now < assessment.availableFrom) {
      throw new BadRequestException("Assessment is not yet available")
    }

    if (assessment.availableUntil && now > assessment.availableUntil) {
      throw new BadRequestException("Assessment is no longer available")
    }
  }

  private async processAnswers(attempt: AssessmentAttempt, answers: Record<string, any>): Promise<AssessmentResult[]> {
    const results: AssessmentResult[] = []

    for (const question of attempt.assessment.questions) {
      const userAnswer = answers[question.id]
      const scoringResult = await this.scoreCalculationService.calculateQuestionScore(question, userAnswer)

      const result = this.resultRepository.create({
        attemptId: attempt.id,
        questionId: question.id,
        userAnswer,
        correctAnswer: this.getCorrectAnswer(question),
        isCorrect: scoringResult.isCorrect,
        pointsEarned: scoringResult.pointsEarned,
        pointsPossible: scoringResult.pointsPossible,
        feedback: scoringResult.feedback,
      })

      const savedResult = await this.resultRepository.save(result)
      results.push(savedResult)
    }

    return results
  }

  private getCorrectAnswer(question: any): any {
    switch (question.type) {
      case "multiple_choice":
        return question.options.find((option) => option.isCorrect)?.id
      case "true_false":
        return question.options.find((option) => option.isCorrect)?.optionText.toLowerCase() === "true"
      case "short_answer":
        return question.metadata?.correctAnswers || []
      case "coding_challenge":
        return question.metadata?.solution || ""
      default:
        return null
    }
  }
}
