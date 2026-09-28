import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Badge } from '../entities/badge.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { User } from '../../users/entities/user.entity';
import { BadgeCategory } from '../enums/badge-category.enum';
import { BadgeCriteriaType } from '../enums/badge-criteria-type.enum';
import { CreateBadgeDto, BadgeFilterDto } from '../dto/badge.dto';
import { DEFAULT_BADGES } from './badge-definitions';
import { PointsService } from '../points/points.service';
import {
  GAMIFICATION_EVENTS,
  CourseCompletedEvent,
  AssessmentSubmittedEvent,
  PointsAwardedEvent,
  ReviewWrittenEvent,
  CourseCreatedEvent,
} from '../events/gamification.events';

@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    @InjectRepository(Badge)
    private badgeRepository: Repository<Badge>,
    @InjectRepository(UserBadge)
    private userBadgeRepository: Repository<UserBadge>,
    private pointsService: PointsService,
  ) {}

  // ─── Admin: Badge Definition Management ───────────────────────────────────

  async createBadge(dto: CreateBadgeDto): Promise<Badge> {
    const badge = this.badgeRepository.create(dto);
    return this.badgeRepository.save(badge);
  }

  async getAllBadges(filter?: BadgeFilterDto): Promise<Badge[]> {
    const where: Partial<Badge> = {};
    if (filter?.category) where.category = filter.category;
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;
    return this.badgeRepository.find({ where, order: { category: 'ASC', name: 'ASC' } });
  }

  async getBadgesByCategory(category: BadgeCategory): Promise<Badge[]> {
    return this.badgeRepository.find({
      where: { category, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getBadgeById(id: string): Promise<Badge> {
    const badge = await this.badgeRepository.findOne({ where: { id } });
    if (!badge) throw new NotFoundException(`Badge ${id} not found`);
    return badge;
  }

  // ─── User Badge Queries ────────────────────────────────────────────────────

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    return this.userBadgeRepository.find({
      where: { userId },
      relations: ['badge'],
      order: { earnedAt: 'DESC' },
    });
  }

  async getUserBadgesByCategory(userId: string, category: BadgeCategory): Promise<UserBadge[]> {
    return this.userBadgeRepository
      .createQueryBuilder('ub')
      .innerJoinAndSelect('ub.badge', 'badge')
      .where('ub.user_id = :userId', { userId })
      .andWhere('badge.category = :category', { category })
      .orderBy('ub.earnedAt', 'DESC')
      .getMany();
  }

  async getUserBadgeCount(userId: string): Promise<number> {
    return this.userBadgeRepository.count({ where: { userId } });
  }

  // ─── Core Award Logic ─────────────────────────────────────────────────────

  async awardBadge(userId: string, badgeId: string): Promise<UserBadge | null> {
    const existing = await this.userBadgeRepository.findOne({
      where: { userId, badgeId },
    });
    if (existing) return null; // already awarded

    const badge = await this.badgeRepository.findOne({ where: { id: badgeId } });
    if (!badge || !badge.isActive) return null;

    const userBadge = this.userBadgeRepository.create({
      user: { id: userId } as User,
      userId,
      badge: { id: badgeId } as Badge,
      badgeId,
    });
    const saved = await this.userBadgeRepository.save(userBadge);

    // Award bonus points for earning the badge
    if (badge.points > 0) {
      await this.pointsService.addPoints(userId, badge.points, 'BADGE_EARNED');
    }

    this.logger.log(`Badge "${badge.name}" awarded to user ${userId}`);
    return saved;
  }

  async checkAndAwardBadges(
    userId: string,
    criteriaType: BadgeCriteriaType,
    value: number,
  ): Promise<UserBadge[]> {
    const badges = await this.badgeRepository.find({
      where: { criteriaType, isActive: true },
    });

    const awarded: UserBadge[] = [];
    for (const badge of badges) {
      const threshold = badge.criteriaValue?.threshold ?? 0;
      if (value >= threshold) {
        const result = await this.awardBadge(userId, badge.id);
        if (result) awarded.push(result);
      }
    }
    return awarded;
  }

  // ─── Seed Default Badges ──────────────────────────────────────────────────

  async seedDefaultBadges(): Promise<void> {
    for (const def of DEFAULT_BADGES) {
      const exists = await this.badgeRepository.findOne({ where: { name: def.name } });
      if (!exists) {
        await this.badgeRepository.save(this.badgeRepository.create(def));
        this.logger.log(`Seeded badge: ${def.name}`);
      }
    }
  }

  // ─── Event Listeners (Automatic Badge Awarding) ───────────────────────────

  @OnEvent(GAMIFICATION_EVENTS.COURSE_COMPLETED)
  async onCourseCompleted(event: CourseCompletedEvent): Promise<void> {
    await this.checkAndAwardBadges(
      event.userId,
      BadgeCriteriaType.COURSES_COMPLETED,
      event.totalCoursesCompleted,
    );
  }

  @OnEvent(GAMIFICATION_EVENTS.ASSESSMENT_SUBMITTED)
  async onAssessmentSubmitted(event: AssessmentSubmittedEvent): Promise<void> {
    if (event.score === 100) {
      await this.checkAndAwardBadges(event.userId, BadgeCriteriaType.ASSESSMENT_PERFECT_SCORE, 1);
    }
    await this.checkAndAwardBadges(
      event.userId,
      BadgeCriteriaType.ASSESSMENTS_PASSED,
      event.totalPassed,
    );
  }

  @OnEvent(GAMIFICATION_EVENTS.POINTS_AWARDED)
  async onPointsAwarded(event: PointsAwardedEvent): Promise<void> {
    await this.checkAndAwardBadges(
      event.userId,
      BadgeCriteriaType.POINTS_REACHED,
      event.totalPoints,
    );
    await this.checkAndAwardBadges(event.userId, BadgeCriteriaType.LEVEL_REACHED, event.level);
  }

  @OnEvent(GAMIFICATION_EVENTS.REVIEW_WRITTEN)
  async onReviewWritten(event: ReviewWrittenEvent): Promise<void> {
    await this.checkAndAwardBadges(
      event.userId,
      BadgeCriteriaType.REVIEWS_WRITTEN,
      event.totalReviews,
    );
  }

  @OnEvent(GAMIFICATION_EVENTS.COURSE_CREATED)
  async onCourseCreated(event: CourseCreatedEvent): Promise<void> {
    await this.checkAndAwardBadges(
      event.userId,
      BadgeCriteriaType.COURSES_CREATED,
      event.totalCoursesCreated,
    );
  }
}
