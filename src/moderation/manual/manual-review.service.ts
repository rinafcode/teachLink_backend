import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationQueue, QueueStatus, QueuePriority } from '../entities/moderation-queue.entity';
import { ModerationAction, ActionType, ActionSeverity } from '../entities/moderation-action.entity';
import { ContentReport, ReportStatus } from '../entities/content-report.entity';
import { SafetyScore } from '../entities/safety-score.entity';
import { ModerationAnalyticsService } from '../analytics/moderation-analytics.service';
import { CreateModerationActionDto } from '../dto/moderation-action.dto';
import { MediaService } from '../../media/media.service';
import { LessonsService } from '../../courses/lessons/lessons.service';
import { CoursesService } from '../../courses/courses.service';
import { ModulesService } from '../../courses/modules/modules.service';
import { UsersService } from '../../users/users.service';

export interface ReviewAssignment {
  queueId: string;
  contentId: string;
  contentType: string;
  priority: QueuePriority;
  safetyScore: number;
  flags: string[];
  reportCount: number;
  estimatedReviewTime: number; // in minutes
}

export interface ReviewDecision {
  action: ActionType;
  severity: ActionSeverity;
  reason: string;
  evidence?: Record<string, any>;
  duration?: number; // for temporary actions
}

@Injectable()
export class ManualReviewService {
  private readonly logger = new Logger(ManualReviewService.name);

  constructor(
    @InjectRepository(ModerationQueue)
    private moderationQueueRepository: Repository<ModerationQueue>,
    @InjectRepository(ModerationAction)
    private moderationActionRepository: Repository<ModerationAction>,
    @InjectRepository(ContentReport)
    private contentReportRepository: Repository<ContentReport>,
    @InjectRepository(SafetyScore)
    private safetyScoreRepository: Repository<SafetyScore>,
    private moderationAnalyticsService: ModerationAnalyticsService,
    private mediaService: MediaService,
    private lessonsService: LessonsService,
    private coursesService: CoursesService,
    private modulesService: ModulesService,
    private usersService: UsersService,
  ) {}

  async getAvailableContent(moderatorId: string, limit = 10): Promise<ReviewAssignment[]> {
    this.logger.log(`Getting available content for moderator ${moderatorId}`);

    // Get pending queue items, ordered by priority and creation time
    const queueItems = await this.moderationQueueRepository
      .createQueryBuilder('queue')
      .where('queue.status = :status', { status: QueueStatus.PENDING })
      .orderBy('queue.priority', 'DESC')
      .addOrderBy('queue.createdAt', 'ASC')
      .limit(limit)
      .getMany();

    const assignments: ReviewAssignment[] = [];

    for (const item of queueItems) {
      // Get additional context
      const reportCount = await this.getReportCount(item.contentId);
      const safetyScore = await this.getLatestSafetyScore(item.contentId);
      const estimatedTime = this.calculateEstimatedReviewTime(item.priority, item.contentType);

      assignments.push({
        queueId: item.id,
        contentId: item.contentId,
        contentType: item.contentType,
        priority: item.priority,
        safetyScore: safetyScore?.overallScore || 0.5,
        flags: item.flags || [],
        reportCount,
        estimatedReviewTime: estimatedTime,
      });
    }

    return assignments;
  }

  async assignContentToModerator(queueId: string, moderatorId: string): Promise<ModerationQueue> {
    this.logger.log(`Assigning content ${queueId} to moderator ${moderatorId}`);

    const queueItem = await this.moderationQueueRepository.findOne({ where: { id: queueId } });
    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    if (queueItem.status !== QueueStatus.PENDING) {
      throw new BadRequestException('Content is not available for assignment');
    }

    // Check if moderator is already assigned to this content
    if (queueItem.assignedModeratorId && queueItem.assignedModeratorId !== moderatorId) {
      throw new BadRequestException('Content is already assigned to another moderator');
    }

    queueItem.assignedModeratorId = moderatorId;
    queueItem.status = QueueStatus.ASSIGNED;
    queueItem.assignedAt = new Date();

    return this.moderationQueueRepository.save(queueItem);
  }

  async startReview(queueId: string, moderatorId: string): Promise<ModerationQueue> {
    this.logger.log(`Starting review for queue item ${queueId} by moderator ${moderatorId}`);

    const queueItem = await this.moderationQueueRepository.findOne({ where: { id: queueId } });
    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    if (queueItem.assignedModeratorId !== moderatorId) {
      throw new BadRequestException('Content not assigned to this moderator');
    }

    if (queueItem.status !== QueueStatus.ASSIGNED) {
      throw new BadRequestException('Content is not in assigned status');
    }

    queueItem.status = QueueStatus.IN_REVIEW;

    return this.moderationQueueRepository.save(queueItem);
  }

  async submitReview(
    queueId: string,
    moderatorId: string,
    decision: ReviewDecision,
  ): Promise<{ queue: ModerationQueue; action: ModerationAction }> {
    this.logger.log(`Submitting review for queue item ${queueId} by moderator ${moderatorId}`);

    const queueItem = await this.moderationQueueRepository.findOne({ where: { id: queueId } });
    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    if (queueItem.assignedModeratorId !== moderatorId) {
      throw new BadRequestException('Content not assigned to this moderator');
    }

    if (queueItem.status !== QueueStatus.IN_REVIEW) {
      throw new BadRequestException('Content is not currently under review');
    }

    // Create moderation action
    const action = this.moderationActionRepository.create({
      contentId: queueItem.contentId,
      contentType: queueItem.contentType,
      moderatorId,
      actionType: decision.action,
      severity: decision.severity,
      reason: decision.reason,
      evidence: decision.evidence,
      duration: decision.duration,
    });

    const savedAction = await this.moderationActionRepository.save(action);

    // Update queue status
    queueItem.status = QueueStatus.COMPLETED;
    queueItem.reviewedAt = new Date();
    const updatedQueue = await this.moderationQueueRepository.save(queueItem);

    // Update reports status
    await this.updateReportsStatus(queueItem.contentId, decision.action);

    // Record analytics
    await this.moderationAnalyticsService.recordReview(moderatorId, decision.action);

    // Execute the action
    await this.executeAction(savedAction);

    return { queue: updatedQueue, action: savedAction };
  }

  async escalateContent(queueId: string, moderatorId: string, reason: string): Promise<ModerationQueue> {
    this.logger.log(`Escalating content ${queueId} by moderator ${moderatorId}`);

    const queueItem = await this.moderationQueueRepository.findOne({ where: { id: queueId } });
    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    if (queueItem.assignedModeratorId !== moderatorId) {
      throw new BadRequestException('Content not assigned to this moderator');
    }

    // Create escalation action
    const action = this.moderationActionRepository.create({
      contentId: queueItem.contentId,
      contentType: queueItem.contentType,
      moderatorId,
      actionType: ActionType.ESCALATE,
      severity: ActionSeverity.HIGH,
      reason: `Escalated: ${reason}`,
      evidence: { escalatedBy: moderatorId, escalationReason: reason },
    });

    await this.moderationActionRepository.save(action);

    // Update queue status
    queueItem.status = QueueStatus.ESCALATED;
    queueItem.priority = QueuePriority.URGENT;

    return this.moderationQueueRepository.save(queueItem);
  }

  async getReviewHistory(moderatorId: string, limit = 20, offset = 0): Promise<{
    items: ModerationAction[];
    total: number;
  }> {
    const [items, total] = await this.moderationActionRepository
      .createQueryBuilder('action')
      .where('action.moderatorId = :moderatorId', { moderatorId })
      .orderBy('action.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  async getContentContext(contentId: string): Promise<{
    safetyScore: SafetyScore | null;
    reports: ContentReport[];
    previousActions: ModerationAction[];
    queueItem: ModerationQueue | null;
  }> {
    const [safetyScore, reports, previousActions, queueItem] = await Promise.all([
      this.safetyScoreRepository.findOne({
        where: { contentId },
        order: { createdAt: 'DESC' },
      }),
      this.contentReportRepository.find({
        where: { contentId },
        order: { createdAt: 'DESC' },
      }),
      this.moderationActionRepository.find({
        where: { contentId },
        order: { createdAt: 'DESC' },
      }),
      this.moderationQueueRepository.findOne({
        where: { contentId },
        order: { createdAt: 'DESC' },
      }),
    ]);

    return {
      safetyScore,
      reports,
      previousActions,
      queueItem,
    };
  }

  private async getReportCount(contentId: string): Promise<number> {
    return this.contentReportRepository.count({
      where: { contentId, status: ReportStatus.PENDING },
    });
  }

  private async getLatestSafetyScore(contentId: string): Promise<SafetyScore | null> {
    return this.safetyScoreRepository.findOne({
      where: { contentId },
      order: { createdAt: 'DESC' },
    });
  }

  private calculateEstimatedReviewTime(priority: QueuePriority, contentType: string): number {
    // Base time in minutes
    let baseTime = 5;

    // Adjust based on content type
    switch (contentType) {
      case 'course':
        baseTime = 15;
        break;
      case 'lesson':
        baseTime = 10;
        break;
      case 'comment':
        baseTime = 2;
        break;
      case 'discussion':
        baseTime = 8;
        break;
    }

    // Adjust based on priority
    switch (priority) {
      case QueuePriority.URGENT:
        baseTime *= 0.5; // Faster review for urgent items
        break;
      case QueuePriority.HIGH:
        baseTime *= 0.8;
        break;
      case QueuePriority.LOW:
        baseTime *= 1.5; // More thorough review for low priority
        break;
    }

    return Math.round(baseTime);
  }

  private async updateReportsStatus(contentId: string, action: ActionType): Promise<void> {
    const status = action === ActionType.APPROVE ? ReportStatus.DISMISSED : ReportStatus.RESOLVED;
    
    await this.contentReportRepository.update(
      { contentId, status: ReportStatus.PENDING },
      { status }
    );
  }

  private async executeAction(action: ModerationAction): Promise<void> {
    this.logger.log(`Executing manual review action: ${action.actionType} on content ${action.contentId}`);

    switch (action.actionType) {
      case ActionType.REMOVE_CONTENT:
        await this.removeContent(action.contentId, action.contentType);
        break;
      case ActionType.HIDE_CONTENT:
        await this.hideContent(action.contentId, action.contentType);
        break;
      case ActionType.SUSPEND:
        await this.suspendUser(action.contentId);
        break;
      case ActionType.BAN:
        await this.banUser(action.contentId);
        break;
      case ActionType.WARN:
        await this.warnUser(action.contentId);
        break;
      default:
        this.logger.log(`Action ${action.actionType} requires manual implementation`);
    }
  }

  private async removeContent(contentId: string, contentType: string): Promise<void> {
    this.logger.log(`Removing content ${contentId} of type ${contentType}`);
    switch (contentType) {
      case 'course':
        await this.coursesService.update(contentId, { isRemoved: true });
        break;
      case 'lesson':
        await this.lessonsService.update(contentId, { isRemoved: true });
        break;
      case 'media':
        await this.mediaService.update(contentId, { isRemoved: true });
        break;
      default:
        this.logger.warn(`Unknown content type for removal: ${contentType}`);
    }
  }

  private async hideContent(contentId: string, contentType: string): Promise<void> {
    this.logger.log(`Hiding content ${contentId} of type ${contentType}`);
    switch (contentType) {
      case 'course':
        await this.coursesService.update(contentId, { isHidden: true });
        break;
      case 'lesson':
        await this.lessonsService.update(contentId, { isHidden: true });
        break;
      case 'media':
        await this.mediaService.update(contentId, { isHidden: true });
        break;
      default:
        this.logger.warn(`Unknown content type for hiding: ${contentType}`);
    }
  }

  private async suspendUser(contentId: string): Promise<void> {
    // Find user by contentId (for course, lesson, media)
    let userId: string | undefined;
    // Try course
    const course = await this.coursesService.findOne(contentId);
    if (course && course.instructorId) userId = course.instructorId;
    // Try lesson
    if (!userId) {
      const lesson = await this.lessonsService.findOne(contentId);
      if (lesson) {
        // Find course for lesson
        const module = await this.modulesService.findOne(lesson.moduleId);
        if (module) {
          const parentCourse = await this.coursesService.findOne(module.courseId);
          if (parentCourse && parentCourse.instructorId) userId = parentCourse.instructorId;
        }
      }
    }
    // Try media
    if (!userId) {
      const media = await this.mediaService.findOne(contentId);
      if (media && media.uploadedById) userId = media.uploadedById;
    }
    if (userId) {
      await this.usersService.update(userId, { isSuspended: true });
      // TODO: Notify user
    } else {
      this.logger.warn(`Could not find user to suspend for content ${contentId}`);
    }
  }

  private async banUser(contentId: string): Promise<void> {
    // Find user by contentId (for course, lesson, media)
    let userId: string | undefined;
    // Try course
    const course = await this.coursesService.findOne(contentId);
    if (course && course.instructorId) userId = course.instructorId;
    // Try lesson
    if (!userId) {
      const lesson = await this.lessonsService.findOne(contentId);
      if (lesson) {
        // Find course for lesson
        const module = await this.modulesService.findOne(lesson.moduleId);
        if (module) {
          const parentCourse = await this.coursesService.findOne(module.courseId);
          if (parentCourse && parentCourse.instructorId) userId = parentCourse.instructorId;
        }
      }
    }
    // Try media
    if (!userId) {
      const media = await this.mediaService.findOne(contentId);
      if (media && media.uploadedById) userId = media.uploadedById;
    }
    if (userId) {
      await this.usersService.update(userId, { isBanned: true });
      // TODO: Notify user
    } else {
      this.logger.warn(`Could not find user to ban for content ${contentId}`);
    }
  }

  private async warnUser(contentId: string): Promise<void> {
    // Find user by contentId (for course, lesson, media)
    let userId: string | undefined;
    // Try course
    const course = await this.coursesService.findOne(contentId);
    if (course && course.instructorId) userId = course.instructorId;
    // Try lesson
    if (!userId) {
      const lesson = await this.lessonsService.findOne(contentId);
      if (lesson) {
        // Find course for lesson
        const module = await this.modulesService.findOne(lesson.moduleId);
        if (module) {
          const parentCourse = await this.coursesService.findOne(module.courseId);
          if (parentCourse && parentCourse.instructorId) userId = parentCourse.instructorId;
        }
      }
    }
    // Try media
    if (!userId) {
      const media = await this.mediaService.findOne(contentId);
      if (media && media.uploadedById) userId = media.uploadedById;
    }
    if (userId) {
      // TODO: Implement warning notification to user
      this.logger.log(`Warning user ${userId} for content ${contentId}`);
    } else {
      this.logger.warn(`Could not find user to warn for content ${contentId}`);
    }
  }
} 