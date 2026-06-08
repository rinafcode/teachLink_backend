import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AssessmentAttempt } from '../entities/assessment-attempt.entity';
import { AssessmentStatus } from '../enums/assessment-status.enum';
import { CriterionGrade } from './entities/criterion-grade.entity';
import { RubricCriterion } from './entities/rubric-criterion.entity';
import { RubricLevel } from './entities/rubric-level.entity';
import { SubmissionGrade, SubmissionGradeStatus } from './entities/submission-grade.entity';
import { RubricsService } from './rubrics.service';
import { FeedbackRenderContext, FeedbackTemplatesService } from './feedback-templates.service';
import { AutoGradeSubmissionDto, CriterionScoreDto, GradeSubmissionDto } from './dto/grading.dto';

/**
 * Orchestrates rubric-based grading of assessment submissions.
 *
 * Two entry points:
 *  - {@link gradeSubmission}     — manual grading from instructor input
 *  - {@link autoGradeSubmission} — uses each criterion's `defaultLevelId`
 *
 * Both paths converge on {@link persistGrade}, which idempotently
 * writes (or rewrites) the SubmissionGrade + CriterionGrade rows for
 * the given attempt and produces rendered feedback.
 */
@Injectable()
export class GradingService {
  constructor(
    @InjectRepository(SubmissionGrade)
    private readonly gradeRepo: Repository<SubmissionGrade>,
    @InjectRepository(CriterionGrade)
    private readonly criterionGradeRepo: Repository<CriterionGrade>,
    @InjectRepository(AssessmentAttempt)
    private readonly attemptRepo: Repository<AssessmentAttempt>,
    private readonly rubricsService: RubricsService,
    private readonly feedbackTemplatesService: FeedbackTemplatesService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Manually grade a submission against a rubric. The grader supplies
   * one score per criterion (level OR explicit points). Each award is
   * capped at the criterion's maxPoints. Re-grading the same attempt
   * mutates the existing record.
   */
  async gradeSubmission(dto: GradeSubmissionDto, graderId?: string): Promise<SubmissionGrade> {
    const rubric = await this.rubricsService.findOne(dto.rubricId);
    const attempt = await this.loadAttempt(dto.attemptId);

    const criterionMap = new Map(rubric.criteria.map((c) => [c.id, c]));
    const levelMap = new Map<string, RubricLevel>();
    for (const c of rubric.criteria) {
      for (const lvl of c.levels ?? []) levelMap.set(lvl.id, lvl);
    }

    if (dto.scores.length !== rubric.criteria.length) {
      throw new BadRequestException(
        `Expected ${rubric.criteria.length} criterion scores but received ${dto.scores.length}.`,
      );
    }

    const seenCriteria = new Set<string>();
    const resolvedScores = dto.scores.map((score) =>
      this.resolveScore(score, criterionMap, levelMap, seenCriteria),
    );

    return this.persistGrade({
      attempt,
      rubric,
      graderId,
      status: SubmissionGradeStatus.GRADED,
      scores: resolvedScores,
      feedbackTemplateId: dto.feedbackTemplateId,
      feedbackOverride: dto.feedbackOverride,
    });
  }

  /**
   * Automatically grade a submission using each criterion's default level.
   * Fails if the rubric isn't auto-grade-enabled (i.e. any criterion is
   * missing a default level).
   */
  async autoGradeSubmission(dto: AutoGradeSubmissionDto): Promise<SubmissionGrade> {
    const rubric = await this.rubricsService.findOne(dto.rubricId);
    if (!rubric.autoGradeEnabled) {
      throw new BadRequestException(
        'Rubric is not configured for auto-grading (no default levels set).',
      );
    }
    const attempt = await this.loadAttempt(dto.attemptId);

    const levelMap = new Map<string, RubricLevel>();
    for (const c of rubric.criteria) {
      for (const lvl of c.levels ?? []) levelMap.set(lvl.id, lvl);
    }

    const resolvedScores = rubric.criteria.map((criterion) => {
      if (!criterion.defaultLevelId) {
        throw new BadRequestException(
          `Criterion "${criterion.title}" has no default level set; cannot auto-grade.`,
        );
      }
      const level = levelMap.get(criterion.defaultLevelId);
      if (!level) {
        throw new BadRequestException(
          `Default level for criterion "${criterion.title}" is missing.`,
        );
      }
      return {
        criterion,
        levelId: level.id,
        points: this.cap(Number(level.points), Number(criterion.maxPoints)),
        comment: undefined as string | undefined,
      };
    });

    return this.persistGrade({
      attempt,
      rubric,
      graderId: undefined,
      status: SubmissionGradeStatus.AUTO_GRADED,
      scores: resolvedScores,
      feedbackTemplateId: dto.feedbackTemplateId,
    });
  }

  /** Returns the grade for an attempt, including criterion-level breakdown. */
  async findByAttempt(attemptId: string): Promise<SubmissionGrade> {
    const grade = await this.gradeRepo.findOne({
      where: { attemptId },
      relations: ['criterionGrades', 'rubric', 'rubric.criteria', 'rubric.criteria.levels'],
    });
    if (!grade) {
      throw new NotFoundException(`No grade found for attempt ${attemptId}`);
    }
    return grade;
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private async loadAttempt(attemptId: string): Promise<AssessmentAttempt> {
    const attempt = await this.attemptRepo.findOne({ where: { id: attemptId } });
    if (!attempt) {
      throw new NotFoundException(`Assessment attempt ${attemptId} not found`);
    }
    return attempt;
  }

  /**
   * Validates and resolves a single criterion score from input.
   * Returns the criterion + final awarded points + selected levelId.
   */
  private resolveScore(
    dto: CriterionScoreDto,
    criterionMap: Map<string, RubricCriterion>,
    levelMap: Map<string, RubricLevel>,
    seen: Set<string>,
  ): {
    criterion: RubricCriterion;
    levelId?: string;
    points: number;
    comment?: string;
  } {
    const criterion = criterionMap.get(dto.criterionId);
    if (!criterion) {
      throw new BadRequestException(
        `Criterion ${dto.criterionId} does not belong to the selected rubric.`,
      );
    }
    if (seen.has(criterion.id)) {
      throw new BadRequestException(`Criterion ${criterion.title} was scored more than once.`);
    }
    seen.add(criterion.id);

    let points: number;
    let levelId: string | undefined;

    if (dto.levelId) {
      const level = levelMap.get(dto.levelId);
      if (!level || level.criterionId !== criterion.id) {
        throw new BadRequestException(
          `Level ${dto.levelId} does not belong to criterion "${criterion.title}".`,
        );
      }
      levelId = level.id;
      points = dto.points !== undefined ? Number(dto.points) : Number(level.points);
    } else if (dto.points !== undefined) {
      points = Number(dto.points);
    } else {
      throw new BadRequestException(
        `Criterion "${criterion.title}" must have either a levelId or explicit points.`,
      );
    }

    return {
      criterion,
      levelId,
      points: this.cap(points, Number(criterion.maxPoints)),
      comment: dto.comment,
    };
  }

  /**
   * Inserts (or updates) the SubmissionGrade row and its CriterionGrade
   * children atomically, then renders feedback (override > template >
   * default template > none) and returns the hydrated record.
   */
  private async persistGrade(args: {
    attempt: AssessmentAttempt;
    rubric: Awaited<ReturnType<RubricsService['findOne']>>;
    graderId?: string;
    status: SubmissionGradeStatus;
    scores: Array<{
      criterion: RubricCriterion;
      levelId?: string;
      points: number;
      comment?: string;
    }>;
    feedbackTemplateId?: string;
    feedbackOverride?: string;
  }): Promise<SubmissionGrade> {
    const { attempt, rubric, graderId, status, scores, feedbackTemplateId, feedbackOverride } =
      args;

    const totalScore = scores.reduce((sum, s) => sum + s.points, 0);
    const maxScore = rubric.criteria.reduce((sum, c) => sum + Number(c.maxPoints), 0);
    const percentage = maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 10000) / 100;

    // Decide which template to render — explicit > default per owner > none.
    let feedback: string | undefined = feedbackOverride;
    let renderedTemplateId: string | undefined;
    if (feedback === undefined) {
      const template = feedbackTemplateId
        ? await this.feedbackTemplatesService.findOne(feedbackTemplateId)
        : await this.feedbackTemplatesService.findDefault(graderId);
      if (template) {
        const ctx = this.buildRenderContext(rubric, scores, totalScore, maxScore);
        feedback = this.feedbackTemplatesService.render(template, ctx);
        renderedTemplateId = template.id;
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const gradeRepo = manager.getRepository(SubmissionGrade);
      const criterionGradeRepo = manager.getRepository(CriterionGrade);
      const attemptRepo = manager.getRepository(AssessmentAttempt);

      let grade = await gradeRepo.findOne({ where: { attemptId: attempt.id } });
      if (!grade) {
        grade = gradeRepo.create({ attemptId: attempt.id });
      }
      grade.rubricId = rubric.id;
      grade.graderId = graderId;
      grade.status = status;
      grade.totalScore = totalScore;
      grade.maxScore = maxScore;
      grade.percentage = percentage;
      grade.feedback = feedback;
      grade.feedbackTemplateId = renderedTemplateId;
      await gradeRepo.save(grade);

      // Wipe and re-insert criterion grades so re-grading is consistent.
      await criterionGradeRepo.delete({ gradeId: grade.id });
      const criterionGrades = scores.map((s) =>
        criterionGradeRepo.create({
          gradeId: grade!.id,
          criterionId: s.criterion.id,
          levelId: s.levelId,
          points: s.points,
          comment: s.comment,
        }),
      );
      if (criterionGrades.length > 0) {
        await criterionGradeRepo.save(criterionGrades);
      }

      // Reflect grading on the assessment attempt.
      attempt.score = totalScore;
      attempt.status = AssessmentStatus.GRADED;
      attempt.submittedAt = attempt.submittedAt ?? new Date();
      await attemptRepo.save(attempt);

      const final = await gradeRepo.findOne({
        where: { id: grade.id },
        relations: ['criterionGrades', 'rubric'],
      });
      return final!;
    });
  }

  private buildRenderContext(
    rubric: Awaited<ReturnType<RubricsService['findOne']>>,
    scores: Array<{
      criterion: RubricCriterion;
      levelId?: string;
      points: number;
    }>,
    totalScore: number,
    maxScore: number,
  ): FeedbackRenderContext {
    const levelById = new Map<string, RubricLevel>();
    for (const c of rubric.criteria) {
      for (const lvl of c.levels ?? []) levelById.set(lvl.id, lvl);
    }
    return {
      score: totalScore,
      maxScore,
      rubric: {
        name: rubric.name,
        criteria: scores.map((s) => ({
          id: s.criterion.id,
          title: s.criterion.title,
          awardedPoints: s.points,
          selectedLevel: s.levelId ? (levelById.get(s.levelId) ?? null) : null,
        })),
      },
    };
  }

  private cap(value: number, max: number): number {
    if (Number.isNaN(value) || value < 0) return 0;
    return value > max ? max : value;
  }
}
