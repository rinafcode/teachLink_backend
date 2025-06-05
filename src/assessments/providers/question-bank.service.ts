import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Question, QuestionType, type QuestionDifficulty } from "../entities/question.entity"
import { QuestionOption } from "../entities/question-option.entity"
import type { CreateQuestionDto } from "../dto/create-question.dto"

@Injectable()
export class QuestionBankService {
  private questionRepository: Repository<Question>
  private questionOptionRepository: Repository<QuestionOption>

  constructor(
    @InjectRepository(Question)
    questionRepository: Repository<Question>,
    @InjectRepository(QuestionOption)
    questionOptionRepository: Repository<QuestionOption>,
  ) {
    this.questionRepository = questionRepository
    this.questionOptionRepository = questionOptionRepository
  }

  async createQuestion(assessmentId: string, createQuestionDto: CreateQuestionDto): Promise<Question> {
    const question = this.questionRepository.create({
      ...createQuestionDto,
      assessmentId,
    })

    const savedQuestion = await this.questionRepository.save(question)

    if (createQuestionDto.options && createQuestionDto.options.length > 0) {
      const options = createQuestionDto.options.map((optionDto) =>
        this.questionOptionRepository.create({
          ...optionDto,
          questionId: savedQuestion.id,
        }),
      )
      await this.questionOptionRepository.save(options)
    }

    return this.findQuestionById(savedQuestion.id)
  }

  async findQuestionById(id: string): Promise<Question> {
    const question = await this.questionRepository.findOne({
      where: { id },
      relations: ["options"],
    })

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`)
    }

    return question
  }

  async findQuestionsByAssessment(assessmentId: string): Promise<Question[]> {
    return this.questionRepository.find({
      where: { assessmentId },
      relations: ["options"],
      order: { orderIndex: "ASC" },
    })
  }

  async findQuestionsByType(type: QuestionType): Promise<Question[]> {
    return this.questionRepository.find({
      where: { type },
      relations: ["options"],
    })
  }

  async findQuestionsByDifficulty(difficulty: QuestionDifficulty): Promise<Question[]> {
    return this.questionRepository.find({
      where: { difficulty },
      relations: ["options"],
    })
  }

  async updateQuestion(id: string, updateData: Partial<CreateQuestionDto>): Promise<Question> {
    const question = await this.findQuestionById(id)

    Object.assign(question, updateData)
    await this.questionRepository.save(question)

    if (updateData.options) {
      // Remove existing options
      await this.questionOptionRepository.delete({ questionId: id })

      // Add new options
      const options = updateData.options.map((optionDto) =>
        this.questionOptionRepository.create({
          ...optionDto,
          questionId: id,
        }),
      )
      await this.questionOptionRepository.save(options)
    }

    return this.findQuestionById(id)
  }

  async deleteQuestion(id: string): Promise<void> {
    const question = await this.findQuestionById(id)
    await this.questionRepository.remove(question)
  }

  async getQuestionStatistics(questionId: string): Promise<any> {
    // This would typically involve complex queries to get statistics
    // For now, returning a placeholder structure
    return {
      questionId,
      totalAttempts: 0,
      correctAnswers: 0,
      averageTimeSpent: 0,
      difficultyRating: 0,
    }
  }

  async shuffleQuestions(questions: Question[]): Promise<Question[]> {
    const shuffled = [...questions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  async validateQuestionStructure(question: Question): Promise<boolean> {
    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
        return question.options && question.options.length >= 2 && question.options.some((option) => option.isCorrect)

      case QuestionType.TRUE_FALSE:
        return question.options && question.options.length === 2

      case QuestionType.SHORT_ANSWER:
      case QuestionType.CODING_CHALLENGE:
        return true // These don't require options

      default:
        return false
    }
  }
}
