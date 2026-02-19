import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AssessmentStatus } from "./enums/assessment-status.enum";
import { Assessment } from "./entities/assessment.entity";
import { AssessmentAttempt } from "./entities/assessment-attempt.entity";
import { FeedbackGenerationService } from "./feedback/feedback-generation.service";
import { Answer } from "./entities/answer.entity";
import { ScoreCalculationService } from "./scoring/score-calculation.service";

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
  ) {}

  async startAssessment(studentId: string, assessmentId: string) {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId },
      relations: ['questions'],
    });

    return this.attemptRepo.save({
      studentId,
      assessment,
      status: AssessmentStatus.IN_PROGRESS,
      startedAt: new Date(),
    });
  }

  async findAll(): Promise<Assessment[]> {
    return await this.assessmentRepo.find({
      relations: ['questions'],
    });
  }

  async findOne(id: string): Promise<Assessment> {
    return await this.assessmentRepo.findOne({
      where: { id },
      relations: ['questions'],
    });
  }

  async findByIds(ids: string[]): Promise<Assessment[]> {
    if (ids.length === 0) return [];
    return await this.assessmentRepo.findByIds(ids);
  }

  async create(data: any): Promise<Assessment> {
    const assessment = this.assessmentRepo.create(data);
    const saved = await this.assessmentRepo.save(assessment);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async update(id: string, data: any): Promise<Assessment> {
    await this.assessmentRepo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.assessmentRepo.delete(id);
  }

  async submitAssessment(attemptId: string, answers: any[]) {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
      relations: ['assessment', 'assessment.questions'],
    });

    const endTime =
      new Date(attempt.startedAt).getTime() +
      attempt.assessment.durationMinutes * 60000;

    if (Date.now() > endTime) {
      attempt.status = AssessmentStatus.TIMED_OUT;
      return this.attemptRepo.save(attempt);
    }

    let totalScore = 0;
    let maxScore = 0;

    for (const question of attempt.assessment.questions) {
      const response = answers.find(
        (a) => a.questionId === question.id,
      )?.response;

      const score = this.scoringService.calculate(question, response);
      maxScore += question.points;
      totalScore += score;

      await this.answerRepo.save({
        attempt,
        question,
        response,
        awardedPoints: score,
      });
    }

    attempt.score = totalScore;
    attempt.status = AssessmentStatus.GRADED;
    attempt.submittedAt = new Date();

    const feedback = this.feedbackService.generate(totalScore, maxScore);

    return {
      attempt: await this.attemptRepo.save(attempt),
      feedback,
    };
  }

  getResults(attemptId: string) {
    return this.attemptRepo.findOne({
      where: { id: attemptId },
      relations: ['answers', 'answers.question'],
    });
  }
}
