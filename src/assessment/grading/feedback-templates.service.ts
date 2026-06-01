import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackTemplate } from './entities/feedback-template.entity';
import { Rubric } from './entities/rubric.entity';
import { RubricCriterion } from './entities/rubric-criterion.entity';
import { RubricLevel } from './entities/rubric-level.entity';
import {
  CreateFeedbackTemplateDto,
  UpdateFeedbackTemplateDto,
} from './dto/grading.dto';

/**
 * Context passed in when rendering a feedback template. Everything is
 * optional — missing keys simply result in `''` substitutions, which
 * keeps the template forgiving when applied to partial grades.
 */
export interface FeedbackRenderContext {
  score: number;
  maxScore: number;
  rubric?: Pick<Rubric, 'name'> & {
    criteria?: Array<
      Pick<RubricCriterion, 'id' | 'title'> & {
        awardedPoints?: number;
        selectedLevel?: Pick<RubricLevel, 'label'> | null;
      }
    >;
  };
}

/**
 * Manages reusable feedback templates and renders their bodies against
 * a `FeedbackRenderContext`. Placeholders are mustache-style:
 *  - `{{score}}` / `{{maxScore}}` / `{{percentage}}` — numeric metrics
 *  - `{{verdict}}` — derived bucket: Excellent / Good / Needs work
 *  - `{{rubric}}` — the rubric's name
 *  - `{{criterion.<title>}}` — points awarded for the named criterion
 *  - `{{level.<criterion-title>}}` — selected level label for that criterion
 *
 * Unknown placeholders render as the empty string. Title matching is
 * case-insensitive and ignores leading/trailing whitespace so that
 * templates are robust to small renames.
 */
@Injectable()
export class FeedbackTemplatesService {
  constructor(
    @InjectRepository(FeedbackTemplate)
    private readonly repo: Repository<FeedbackTemplate>,
  ) {}

  async create(
    dto: CreateFeedbackTemplateDto,
    ownerId?: string,
  ): Promise<FeedbackTemplate> {
    const tpl = this.repo.create({
      name: dto.name,
      body: dto.body,
      isDefault: dto.isDefault ?? false,
      ownerId,
    });
    return this.repo.save(tpl);
  }

  async findOne(id: string): Promise<FeedbackTemplate> {
    const tpl = await this.repo.findOne({ where: { id } });
    if (!tpl) {
      throw new NotFoundException(`Feedback template ${id} not found`);
    }
    return tpl;
  }

  /** Lists templates, optionally narrowed to a specific owner. */
  async findAll(ownerId?: string): Promise<FeedbackTemplate[]> {
    return this.repo.find({
      where: ownerId ? { ownerId } : {},
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  /** Returns the first `isDefault=true` template owned by the user, if any. */
  async findDefault(ownerId?: string): Promise<FeedbackTemplate | null> {
    return this.repo.findOne({
      where: { isDefault: true, ...(ownerId ? { ownerId } : {}) },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    dto: UpdateFeedbackTemplateDto,
    requestingUserId?: string,
  ): Promise<FeedbackTemplate> {
    const tpl = await this.findOne(id);
    this.assertOwner(tpl, requestingUserId);
    if (dto.name !== undefined) tpl.name = dto.name;
    if (dto.body !== undefined) tpl.body = dto.body;
    if (dto.isDefault !== undefined) tpl.isDefault = dto.isDefault;
    return this.repo.save(tpl);
  }

  async remove(id: string, requestingUserId?: string): Promise<void> {
    const tpl = await this.findOne(id);
    this.assertOwner(tpl, requestingUserId);
    await this.repo.softDelete(id);
  }

  /**
   * Renders a template body against a grading context. Pure function —
   * has no side effects on persistence.
   */
  render(template: FeedbackTemplate | string, ctx: FeedbackRenderContext): string {
    const body = typeof template === 'string' ? template : template.body;
    const safeMax = ctx.maxScore > 0 ? ctx.maxScore : 0;
    const percentage = safeMax === 0 ? 0 : Math.round((ctx.score / safeMax) * 10000) / 100;

    const verdict = this.deriveVerdict(percentage);

    const criteria = ctx.rubric?.criteria ?? [];
    const criterionByTitle = new Map(
      criteria.map(c => [this.normalize(c.title), c]),
    );

    return body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawKey: string) => {
      const key = rawKey.trim();
      switch (key.toLowerCase()) {
        case 'score':
          return String(ctx.score);
        case 'maxscore':
          return String(safeMax);
        case 'percentage':
          return `${percentage}%`;
        case 'verdict':
          return verdict;
        case 'rubric':
          return ctx.rubric?.name ?? '';
        default:
          break;
      }

      const criterionMatch = key.match(/^criterion\.(.+)$/i);
      if (criterionMatch) {
        const c = criterionByTitle.get(this.normalize(criterionMatch[1]));
        return c?.awardedPoints !== undefined ? String(c.awardedPoints) : '';
      }

      const levelMatch = key.match(/^level\.(.+)$/i);
      if (levelMatch) {
        const c = criterionByTitle.get(this.normalize(levelMatch[1]));
        return c?.selectedLevel?.label ?? '';
      }

      return '';
    });
  }

  private deriveVerdict(percentage: number): string {
    if (percentage >= 80) return 'Excellent';
    if (percentage >= 50) return 'Good';
    return 'Needs work';
  }

  private normalize(s: string): string {
    return s.trim().toLowerCase();
  }

  private assertOwner(tpl: FeedbackTemplate, userId?: string): void {
    if (!tpl.ownerId) return;
    if (userId && tpl.ownerId === userId) return;
    throw new ForbiddenException('Only the template owner may modify this template.');
  }
}
