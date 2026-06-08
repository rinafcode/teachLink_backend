import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Rubric } from './entities/rubric.entity';
import { RubricCriterion } from './entities/rubric-criterion.entity';
import { RubricLevel } from './entities/rubric-level.entity';
import {
  CreateRubricCriterionDto,
  CreateRubricDto,
  UpdateRubricDto,
} from './dto/rubric.dto';

/**
 * Manages rubric definitions: a `Rubric` is the parent record, holding
 * many `RubricCriterion` rows, each with one or more `RubricLevel` rows.
 *
 * The service is the single source of truth for the rubric's
 * `totalPoints` (sum of criteria `maxPoints`) and `autoGradeEnabled`
 * (true only when every criterion has a `defaultLevelId`).
 */
@Injectable()
export class RubricsService {
  constructor(
    @InjectRepository(Rubric)
    private readonly rubricRepo: Repository<Rubric>,
    @InjectRepository(RubricCriterion)
    private readonly criterionRepo: Repository<RubricCriterion>,
    @InjectRepository(RubricLevel)
    private readonly levelRepo: Repository<RubricLevel>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Atomically creates a rubric with its criteria and per-criterion
   * levels. Validates that:
   *  - each criterion has at least one level
   *  - `defaultLevelIndex` (if provided) is in range
   *  - when `autoGradeEnabled` is requested, every criterion has a default
   */
  async create(dto: CreateRubricDto, ownerId?: string): Promise<Rubric> {
    this.validateCriteria(dto.criteria, dto.autoGradeEnabled === true);

    return this.dataSource.transaction(async manager => {
      const rubricRepo = manager.getRepository(Rubric);
      const criterionRepo = manager.getRepository(RubricCriterion);
      const levelRepo = manager.getRepository(RubricLevel);

      const rubric = rubricRepo.create({
        name: dto.name,
        description: dto.description,
        assessmentId: dto.assessmentId,
        ownerId,
        autoGradeEnabled: false, // updated below once default levels are saved
        totalPoints: 0,
      });
      await rubricRepo.save(rubric);

      let totalPoints = 0;
      let everyHasDefault = true;

      for (const cDto of dto.criteria) {
        const criterion = criterionRepo.create({
          rubricId: rubric.id,
          title: cDto.title,
          description: cDto.description,
          maxPoints: cDto.maxPoints,
          orderIndex: cDto.orderIndex ?? 0,
        });
        await criterionRepo.save(criterion);

        const savedLevels: RubricLevel[] = [];
        for (let i = 0; i < cDto.levels.length; i++) {
          const lDto = cDto.levels[i];
          const level = levelRepo.create({
            criterionId: criterion.id,
            label: lDto.label,
            description: lDto.description,
            points: lDto.points,
            orderIndex: lDto.orderIndex ?? i,
          });
          await levelRepo.save(level);
          savedLevels.push(level);
        }

        if (cDto.defaultLevelIndex !== undefined) {
          const idx = cDto.defaultLevelIndex;
          if (idx < 0 || idx >= savedLevels.length) {
            throw new BadRequestException(
              `defaultLevelIndex ${idx} is out of range for criterion "${cDto.title}"`,
            );
          }
          criterion.defaultLevelId = savedLevels[idx].id;
          await criterionRepo.save(criterion);
        } else {
          everyHasDefault = false;
        }

        totalPoints += Number(cDto.maxPoints);
      }

      rubric.totalPoints = totalPoints;
      rubric.autoGradeEnabled = (dto.autoGradeEnabled ?? false) && everyHasDefault;
      await rubricRepo.save(rubric);

      return this.findOneById(rubric.id, manager.getRepository(Rubric));
    });
  }

  /** Returns a fully-hydrated rubric with criteria and their levels. */
  async findOne(id: string): Promise<Rubric> {
    return this.findOneById(id, this.rubricRepo);
  }

  /** Lists rubrics, optionally filtering by owner. */
  async findAll(ownerId?: string): Promise<Rubric[]> {
    return this.rubricRepo.find({
      where: ownerId ? { ownerId } : {},
      order: { createdAt: 'DESC' },
      relations: ['criteria', 'criteria.levels'],
    });
  }

  /**
   * Updates rubric metadata (name/description/assessmentId/autoGrade).
   * Criterion/level structure is intentionally not editable here — use
   * dedicated APIs to keep the bookkeeping correct.
   */
  async update(id: string, dto: UpdateRubricDto, requestingUserId?: string): Promise<Rubric> {
    const rubric = await this.findOne(id);
    this.assertOwner(rubric, requestingUserId);

    if (dto.name !== undefined) rubric.name = dto.name;
    if (dto.description !== undefined) rubric.description = dto.description;
    if (dto.assessmentId !== undefined) rubric.assessmentId = dto.assessmentId;

    if (dto.autoGradeEnabled !== undefined) {
      if (dto.autoGradeEnabled) {
        const missing = (rubric.criteria ?? []).filter(c => !c.defaultLevelId);
        if (missing.length > 0) {
          throw new BadRequestException(
            'Cannot enable auto-grading: some criteria have no default level set.',
          );
        }
      }
      rubric.autoGradeEnabled = dto.autoGradeEnabled;
    }

    await this.rubricRepo.save(rubric);
    return this.findOne(id);
  }

  /** Soft-deletes a rubric. */
  async remove(id: string, requestingUserId?: string): Promise<void> {
    const rubric = await this.findOne(id);
    this.assertOwner(rubric, requestingUserId);
    await this.rubricRepo.softDelete(id);
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async findOneById(id: string, repo: Repository<Rubric>): Promise<Rubric> {
    const rubric = await repo.findOne({
      where: { id },
      relations: ['criteria', 'criteria.levels'],
    });
    if (!rubric) {
      throw new NotFoundException(`Rubric ${id} not found`);
    }
    // Sort criteria and their levels by orderIndex for a stable scoring UI.
    rubric.criteria?.sort((a, b) => a.orderIndex - b.orderIndex);
    rubric.criteria?.forEach(c => c.levels?.sort((a, b) => a.orderIndex - b.orderIndex));
    return rubric;
  }

  private validateCriteria(
    criteria: CreateRubricCriterionDto[],
    autoGradeRequested: boolean,
  ): void {
    for (const c of criteria) {
      if (!c.levels || c.levels.length === 0) {
        throw new BadRequestException(`Criterion "${c.title}" must have at least one level.`);
      }
      const maxLevelPoints = Math.max(...c.levels.map(l => l.points));
      if (Number(c.maxPoints) < maxLevelPoints) {
        throw new BadRequestException(
          `Criterion "${c.title}" maxPoints (${c.maxPoints}) is less than its top level points (${maxLevelPoints}).`,
        );
      }
      if (autoGradeRequested && c.defaultLevelIndex === undefined) {
        throw new BadRequestException(
          `Criterion "${c.title}" must specify defaultLevelIndex when autoGradeEnabled=true.`,
        );
      }
    }
  }

  private assertOwner(rubric: Rubric, userId?: string): void {
    // When the rubric has no owner, no ownership check applies.
    if (!rubric.ownerId) return;
    if (userId && rubric.ownerId === userId) return;
    throw new ForbiddenException('Only the rubric owner may modify this rubric.');
  }
}
