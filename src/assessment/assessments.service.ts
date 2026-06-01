import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentStatus } from './enums/assessment-status.enum';
import { Assessment } from './entities/assessment.entity';
import { AssessmentAttempt } from './entities/assessment-attempt.entity';
import { FeedbackGenerationService } from './feedback/feedback-generation.service';
import { Answer } from './entities/answer.entity';
import { ScoreCalculationService } from './scoring/score-calculation.service';
import { Question } from './entities/question.entity';
import { AnalyticsService } from '../analytics/analytics.service';

/**
 * Provides assessment operations.
 */
@Injectable()
export class AssessmentsService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(AssessmentAttempt)
    private readonly attemptRepo: Repository<AssessmentAttempt>,
    @InjectRepository(Answer)
    private readonly answerRepo: Repository<Answer>,
    private readonly scoringService: ScoreCalculationService,
    private readonly feedbackService: FeedbackGenerationService,
    private readonly analytics: AnalyticsService,
  ) {}

  /**
   * Starts assessment.
   */
  async startAssessment(studentId: string, assessmentId: string) {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId },
      relations: ['questions'],
    });

    const attempt = await this.attemptRepo.save({
      studentId,
      assessment,
      status: AssessmentStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    this.analytics.recordAssessmentStarted(assessmentId);

    return attempt;
  }

  /**
   * Retrieves all assessments.
   */
  async findAll(): Promise<Assessment[]> {
    return this.assessmentRepo.find({ relations: ['questions'] });
  }

  /**
   * Retrieves an assessment by id.
   */
  async findOne(id: string): Promise<Assessment> {
    return this.assessmentRepo.findOne({ where: { id }, relations: ['questions'] });
  }

  /**
   * Retrieves assessments by ids.
   */
  async findByIds(ids: string[]): Promise<Assessment[]> {
    if (ids.length === 0) return [];
    return this.assessmentRepo.findByIds(ids);
  }

  /**
   * Creates a new assessment.
   */
  async create(data: any): Promise<Assessment> {
    const assessment = this.assessmentRepo.create(data);
    const saved = await this.assessmentRepo.save(assessment);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /**
   * Updates an assessment.
   */
  async update(id: string, data: any): Promise<Assessment> {
    await this.assessmentRepo.update(id, data);
    return this.findOne(id);
  }

  /**
   * Soft-deletes an assessment and its questions.
   */
  async remove(id: string): Promise<void> {
    const assessment = await this.findOne(id);
    if (!assessment) return;

    await this.assessmentRepo.manager.transaction(async (manager) => {
      await manager
        .getRepository(Question)
        .createQueryBuilder()
        .softDelete()
        .where('"assessmentId" = :assessmentId', { assessmentId: id })
        .execute();
      await manager.getRepository(Assessment).softDelete(id);
    });
  }

  /**
   * Submits an assessment attempt, grades answers, and generates feedback.
   */
  async submitAssessment(attemptId: string, answers: any[]) {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
      relations: ['assessment', 'assessment.questions'],
    });

    if (!attempt?.assessment?.questions) {
      throw new NotFoundException(`Attempt ${attemptId} not found`);
    }

    const endTime =
      new Date(attempt.startedAt).getTime() + attempt.assessment.durationMinutes * 60000;

    if (Date.now() > endTime) {
      attempt.status = AssessmentStatus.TIMED_OUT;
      this.analytics.recordAssessmentTimedOut(attempt.assessment.id, attempt.startedAt);
      return this.attemptRepo.save(attempt);
    }

    let totalScore = 0;
    let maxScore = 0;

    for (const question of attempt.assessment.questions) {
      const response = answers.find((a) => a.questionId === question.id)?.response;
      const score = this.scoringService.calculate(question, response);
      maxScore += question.points;
      totalScore += score;
      await this.answerRepo.save({ attempt, question, response, awardedPoints: score });
    }

    attempt.score = totalScore;
    attempt.status = AssessmentStatus.GRADED;
    attempt.submittedAt = new Date();

    this.analytics.recordAssessmentSubmitted(attempt.assessment.id, attempt.startedAt);
    this.analytics.recordAssessmentScore(totalScore, maxScore);

    const feedback = this.feedbackService.generate(totalScore, maxScore);

    return {
      attempt: await this.attemptRepo.save(attempt),
      feedback,
    };
  }

  /**
   * Retrieves attempt results with answers.
   */
  getResults(attemptId: string) {
    return this.attemptRepo.findOne({
      where: { id: attemptId },
      relations: ['answers', 'answers.question'],
    });
  }
}