import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ManualReviewService } from '../manual/manual-review.service';
import { ReportAssignmentService } from '../assignment/report-assignment.service';
import { ContentReportReason } from './content-report-reason.enum';
import { ContentReportStatus } from './content-report-status.enum';
import { ContentReport } from './content-report.entity';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { ContentReportDisposition, ReviewContentReportDto } from './dto/review-content-report.dto';
import { ListContentReportsQueryDto } from './dto/list-content-reports-query.dto';

const REPORT_REASON_SCORES: Record<ContentReportReason, number> = {
  [ContentReportReason.SPAM]: 0.85,
  [ContentReportReason.ABUSE]: 0.95,
  [ContentReportReason.INAPPROPRIATE]: 0.75,
};

@Injectable()
export class ContentReportingService {
  private readonly logger = new Logger(ContentReportingService.name);

  constructor(
    @InjectRepository(ContentReport)
    private readonly reportRepo: Repository<ContentReport>,
    private readonly manualReviewService: ManualReviewService,
    private readonly assignmentService: ReportAssignmentService,
  ) {}

  async reportContent(dto: CreateContentReportDto, reporter: User): Promise<ContentReport> {
    const report = this.reportRepo.create({
      contentType: dto.contentType.trim(),
      contentId: dto.contentId.trim(),
      reason: dto.reason,
      details: dto.details?.trim() || undefined,
      reporterId: reporter.id,
      status: ContentReportStatus.PENDING,
    });

    const saved = await this.reportRepo.save(report);

    const queueItem = await this.manualReviewService.enqueue(
      this.buildQueueSummary(saved),
      REPORT_REASON_SCORES[saved.reason],
      {
        sourceType: 'content-report',
        sourceId: saved.id,
        reportId: saved.id,
      },
    );

    saved.moderationItemId = queueItem.id;
    const linkedReport = await this.reportRepo.save(saved);

    this.logger.log(
      `Content report ${linkedReport.id} queued for ${linkedReport.contentType}:${linkedReport.contentId} by ${reporter.id}`,
    );

    // Assign the new report to a moderator via round-robin (best-effort).
    const assignedReport = await this.assignmentService.assignReport(linkedReport);

    return assignedReport;
  }

  async listReports(
    query: ListContentReportsQueryDto,
    requestingUser: User,
  ): Promise<ContentReport[]> {
    this.assertModerator(requestingUser);

    const where: FindOptionsWhere<ContentReport> = {};
    if (query.status) where.status = query.status;
    if (query.reason) where.reason = query.reason;
    if (query.contentType) where.contentType = query.contentType;

    return this.reportRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit ?? 50,
    });
  }

  async getQueue(requestingUser: User): Promise<ContentReport[]> {
    this.assertModerator(requestingUser);
    return this.reportRepo.find({
      where: [
        { status: ContentReportStatus.PENDING },
        { status: ContentReportStatus.UNDER_REVIEW },
      ],
      order: { createdAt: 'ASC' },
    });
  }

  async getReportById(id: string, requestingUser: User): Promise<ContentReport> {
    const report = await this.reportRepo.findOne({ where: { id } });

    if (!report) {
      throw new NotFoundException(`Content report ${id} not found`);
    }

    if (!this.canViewReport(report, requestingUser)) {
      throw new ForbiddenException('You are not allowed to view this report.');
    }

    return report;
  }

  async reviewReport(
    id: string,
    dto: ReviewContentReportDto,
    reviewer: User,
  ): Promise<ContentReport> {
    this.assertModerator(reviewer);

    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException(`Content report ${id} not found`);
    }

    if (
      report.status === ContentReportStatus.RESOLVED ||
      report.status === ContentReportStatus.DISMISSED
    ) {
      throw new BadRequestException(`Content report ${id} has already been finalized.`);
    }

    report.status =
      dto.disposition === ContentReportDisposition.RESOLVE
        ? ContentReportStatus.RESOLVED
        : ContentReportStatus.DISMISSED;
    report.reviewerId = reviewer.id;
    report.resolutionNote = dto.resolutionNote?.trim() || undefined;
    report.resolvedAt = new Date();

    const saved = await this.reportRepo.save(report);

    if (saved.moderationItemId) {
      await this.manualReviewService.markReviewed(saved.moderationItemId);
    }

    this.logger.log(`Content report ${saved.id} finalized as ${saved.status} by ${reviewer.id}`);

    return saved;
  }

  private assertModerator(user: User): void {
    const isPrivileged =
      user.roles?.some((role) => ['admin', 'moderator'].includes(role.name)) ?? false;
    if (!isPrivileged) {
      throw new ForbiddenException('Only admins or moderators may access the reporting queue.');
    }
  }

  private canViewReport(report: ContentReport, user: User): boolean {
    const isPrivileged =
      user.roles?.some((role) => ['admin', 'moderator'].includes(role.name)) ?? false;
    return isPrivileged || report.reporterId === user.id;
  }

  private buildQueueSummary(report: ContentReport): string {
    return [
      'Content report',
      `type=${report.contentType}`,
      `id=${report.contentId}`,
      `reason=${report.reason}`,
      report.details ? `details=${report.details}` : undefined,
    ]
      .filter(Boolean)
      .join(' | ');
  }
}
