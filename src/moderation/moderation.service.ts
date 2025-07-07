import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentReport, ReportStatus } from './entities/content-report.entity';
import { ModerationQueue, QueueStatus, QueuePriority } from './entities/moderation-queue.entity';
import { ModerationAction, ActionType } from './entities/moderation-action.entity';
import { SafetyScore } from './entities/safety-score.entity';
import { AutoModerationService } from './auto/auto-moderation.service';
import { ManualReviewService } from './manual/manual-review.service';
import { ContentSafetyService } from './safety/content-safety.service';
import { ModerationAnalyticsService } from './analytics/moderation-analytics.service';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { CreateModerationActionDto } from './dto/moderation-action.dto';
import { MediaService } from '../media/media.service';
import { LessonsService } from '../courses/lessons/lessons.service';
import { CoursesService } from '../courses/courses.service';
import { ModulesService } from '../courses/modules/modules.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    @InjectRepository(ContentReport)
    private contentReportRepository: Repository<ContentReport>,
    @InjectRepository(ModerationQueue)
    private moderationQueueRepository: Repository<ModerationQueue>,
    @InjectRepository(ModerationAction)
    private moderationActionRepository: Repository<ModerationAction>,
    @InjectRepository(SafetyScore)
    private safetyScoreRepository: Repository<SafetyScore>,
    private autoModerationService: AutoModerationService,
    private manualReviewService: ManualReviewService,
    private contentSafetyService: ContentSafetyService,
    private moderationAnalyticsService: ModerationAnalyticsService,
    private mediaService: MediaService,
    private lessonsService: LessonsService,
    private coursesService: CoursesService,
    private modulesService: ModulesService,
    private usersService: UsersService,
  ) {}

  async reportContent(reporterId: string, reportDto: CreateContentReportDto): Promise<ContentReport> {
    this.logger.log(`Content reported by user ${reporterId} for content ${reportDto.contentId}`);

    // Create content report
    const report = this.contentReportRepository.create({
      reporterId,
      ...reportDto,
      status: ReportStatus.PENDING,
    });

    const savedReport = await this.contentReportRepository.save(report);

    // Perform automated content analysis
    const safetyScore = await this.contentSafetyService.analyzeContent(
      reportDto.contentId,
      reportDto.contentType,
    );

    // Determine priority based on safety score and report type
    const priority = this.calculatePriority(safetyScore.overallScore, reportDto.reportType);

    // Add to moderation queue
    await this.addToModerationQueue(reportDto.contentId, reportDto.contentType, priority, savedReport.id, safetyScore);

    // Trigger automated moderation if safety score is low
    if (safetyScore.overallScore < 0.3) {
      await this.autoModerationService.processContent(reportDto.contentId, reportDto.contentType);
    }

    return savedReport;
  }

  async getModerationQueue(
    moderatorId?: string,
    status?: QueueStatus,
    priority?: QueuePriority,
    limit = 20,
    offset = 0,
  ): Promise<{ items: ModerationQueue[]; total: number }> {
    const query = this.moderationQueueRepository.createQueryBuilder('queue');

    if (moderatorId) {
      query.andWhere('queue.assignedModeratorId = :moderatorId', { moderatorId });
    }

    if (status) {
      query.andWhere('queue.status = :status', { status });
    }

    if (priority) {
      query.andWhere('queue.priority = :priority', { priority });
    }

    const [items, total] = await query
      .orderBy('queue.priority', 'DESC')
      .addOrderBy('queue.createdAt', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  async assignContentToModerator(queueId: string, moderatorId: string): Promise<ModerationQueue> {
    const queueItem = await this.moderationQueueRepository.findOne({ where: { id: queueId } });
    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    if (queueItem.status !== QueueStatus.PENDING) {
      throw new BadRequestException('Content is not available for assignment');
    }

    queueItem.assignedModeratorId = moderatorId;
    queueItem.status = QueueStatus.ASSIGNED;
    queueItem.assignedAt = new Date();

    return this.moderationQueueRepository.save(queueItem);
  }

  async reviewContent(
    queueId: string,
    moderatorId: string,
    actionDto: CreateModerationActionDto,
  ): Promise<{ queue: ModerationQueue; action: ModerationAction }> {
    const queueItem = await this.moderationQueueRepository.findOne({ where: { id: queueId } });
    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    if (queueItem.assignedModeratorId !== moderatorId) {
      throw new BadRequestException('Content not assigned to this moderator');
    }

    // Create moderation action
    const action = this.moderationActionRepository.create({
      ...actionDto,
      moderatorId,
    });

    const savedAction = await this.moderationActionRepository.save(action);

    // Update queue status
    queueItem.status = QueueStatus.COMPLETED;
    queueItem.reviewedAt = new Date();
    const updatedQueue = await this.moderationQueueRepository.save(queueItem);

    // Update analytics
    await this.moderationAnalyticsService.recordReview(moderatorId, actionDto.actionType);

    // Execute action
    await this.executeModerationAction(savedAction);

    return { queue: updatedQueue, action: savedAction };
  }

  async getContentReports(
    contentId?: string,
    status?: ReportStatus,
    limit = 20,
    offset = 0,
  ): Promise<{ items: ContentReport[]; total: number }> {
    const query = this.contentReportRepository.createQueryBuilder('report');

    if (contentId) {
      query.andWhere('report.contentId = :contentId', { contentId });
    }

    if (status) {
      query.andWhere('report.status = :status', { status });
    }

    const [items, total] = await query
      .orderBy('report.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  async getSafetyScore(contentId: string): Promise<SafetyScore> {
    const safetyScore = await this.safetyScoreRepository.findOne({
      where: { contentId },
      order: { createdAt: 'DESC' },
    });

    if (!safetyScore) {
      throw new NotFoundException('Safety score not found for this content');
    }

    return safetyScore;
  }

  async reanalyzeContent(contentId: string, contentType: string): Promise<SafetyScore> {
    this.logger.log(`Reanalyzing content ${contentId} for safety`);

    const safetyScore = await this.contentSafetyService.analyzeContent(contentId, contentType);
    
    // Update queue priority if needed
    await this.updateQueuePriority(contentId, safetyScore.overallScore);

    return safetyScore;
  }

  private async addToModerationQueue(
    contentId: string,
    contentType: string,
    priority: QueuePriority,
    reportId?: string,
    safetyScore?: SafetyScore,
  ): Promise<ModerationQueue> {
    const queueItem = this.moderationQueueRepository.create({
      contentId,
      contentType,
      priority,
      reportId,
      safetyScore: safetyScore?.overallScore,
      autoModerationResult: safetyScore?.aiAnalysis,
      flags: safetyScore?.flaggedCategories,
    });

    return this.moderationQueueRepository.save(queueItem);
  }

  private calculatePriority(safetyScore: number, reportType: string): QueuePriority {
    if (safetyScore < 0.2) return QueuePriority.URGENT;
    if (safetyScore < 0.4) return QueuePriority.HIGH;
    if (safetyScore < 0.6) return QueuePriority.MEDIUM;
    return QueuePriority.LOW;
  }

  private async updateQueuePriority(contentId: string, safetyScore: number): Promise<void> {
    const queueItem = await this.moderationQueueRepository.findOne({
      where: { contentId, status: QueueStatus.PENDING },
    });

    if (queueItem) {
      const newPriority = this.calculatePriority(safetyScore, queueItem.contentType);
      if (newPriority !== queueItem.priority) {
        queueItem.priority = newPriority;
        await this.moderationQueueRepository.save(queueItem);
      }
    }
  }

  private async executeModerationAction(action: ModerationAction): Promise<void> {
    this.logger.log(`Executing moderation action: ${action.actionType} on content ${action.contentId}`);

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
} 