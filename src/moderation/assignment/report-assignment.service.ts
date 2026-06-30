import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import { User, UserRole } from '../../users/entities/user.entity';
import { ContentReport } from '../reports/content-report.entity';
import { ContentReportStatus } from '../reports/content-report-status.enum';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  NotificationPriority,
  NotificationType,
} from '../../notifications/entities/notification.entity';

/**
 * Manages report assignment and escalation for the moderation queue.
 *
 * Assignment strategy: round-robin over the active moderator pool.
 * Escalation: any report still in PENDING or UNDER_REVIEW status after
 * `MODERATION_SLA_HOURS` (default 24 h) is re-assigned to a random admin.
 */
@Injectable()
export class ReportAssignmentService {
  private readonly logger = new Logger(ReportAssignmentService.name);

  /** Default SLA in hours before a report is escalated. */
  static readonly DEFAULT_SLA_HOURS = 24;

  /** Round-robin cursor — index into the sorted moderator pool. */
  private rrCursor = 0;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ContentReport)
    private readonly reportRepo: Repository<ContentReport>,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Assigns `report` to the next available moderator using round-robin.
   *
   * Sends an IN_APP notification to the assigned moderator.
   * No-ops silently when no moderators exist (report remains unassigned).
   */
  async assignReport(report: ContentReport): Promise<ContentReport> {
    const moderators = await this.getActiveModerators();

    if (moderators.length === 0) {
      this.logger.warn(`No active moderators found; report ${report.id} left unassigned`);
      return report;
    }

    const moderator = moderators[this.rrCursor % moderators.length];
    this.rrCursor = (this.rrCursor + 1) % moderators.length;

    report.assignedModeratorId = moderator.id;
    report.status = ContentReportStatus.UNDER_REVIEW;
    const saved = await this.reportRepo.save(report);

    this.logger.log(`Report ${report.id} assigned to moderator ${moderator.id}`);

    await this.sendAssignmentNotification(moderator, saved);

    return saved;
  }

  /**
   * Escalates `report` to a random admin and marks `escalatedAt`.
   *
   * Sends a HIGH-priority IN_APP notification to the escalation recipient.
   * No-ops when no admins exist.
   */
  async escalateReport(report: ContentReport): Promise<ContentReport> {
    const admins = await this.getActiveAdmins();

    if (admins.length === 0) {
      this.logger.warn(`No active admins found; report ${report.id} cannot be escalated`);
      return report;
    }

    const admin = admins[Math.floor(Math.random() * admins.length)];

    report.assignedModeratorId = admin.id;
    report.escalatedAt = new Date();
    const saved = await this.reportRepo.save(report);

    this.logger.warn(`Report ${report.id} escalated to admin ${admin.id}`);

    await this.sendEscalationNotification(admin, saved);

    return saved;
  }

  /**
   * Scheduled task — runs every 5 minutes.
   *
   * Finds all PENDING/UNDER_REVIEW reports whose `createdAt` exceeds the
   * configured SLA and have not yet been escalated, then escalates them.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async escalateOverdueReports(): Promise<void> {
    const slaHours = this.configService.get<number>(
      'MODERATION_SLA_HOURS',
      ReportAssignmentService.DEFAULT_SLA_HOURS,
    );

    const slaThreshold = new Date();
    slaThreshold.setHours(slaThreshold.getHours() - slaHours);

    const overdueReports = await this.reportRepo.find({
      where: [
        {
          status: ContentReportStatus.PENDING,
          escalatedAt: undefined,
          createdAt: LessThan(slaThreshold),
        },
        {
          status: ContentReportStatus.UNDER_REVIEW,
          escalatedAt: undefined,
          createdAt: LessThan(slaThreshold),
        },
      ],
    });

    if (overdueReports.length === 0) {
      return;
    }

    this.logger.warn(`Escalating ${overdueReports.length} overdue report(s) (SLA: ${slaHours}h)`);

    for (const report of overdueReports) {
      await this.escalateReport(report);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async getActiveModerators(): Promise<User[]> {
    return this.userRepo
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.name = :role', { role: UserRole.MODERATOR })
      .orderBy('user.id', 'ASC')
      .getMany();
  }

  private async getActiveAdmins(): Promise<User[]> {
    return this.userRepo
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.name = :role', { role: UserRole.ADMIN })
      .orderBy('user.id', 'ASC')
      .getMany();
  }

  private async sendAssignmentNotification(moderator: User, report: ContentReport): Promise<void> {
    try {
      await this.notificationsService.send({
        userId: moderator.id,
        title: 'New content report assigned',
        content: `You have been assigned a new ${report.reason} report for ${report.contentType} content. Please review it promptly.`,
        type: NotificationType.IN_APP,
        priority: NotificationPriority.HIGH,
        metadata: { reportId: report.id, contentType: report.contentType, reason: report.reason },
      });
    } catch (err) {
      this.logger.error(`Failed to send assignment notification to moderator ${moderator.id}`, err);
    }
  }

  private async sendEscalationNotification(admin: User, report: ContentReport): Promise<void> {
    try {
      await this.notificationsService.send({
        userId: admin.id,
        title: 'Escalated content report requires urgent review',
        content: `A ${report.reason} report (ID: ${report.id}) has exceeded the SLA and has been escalated to you for immediate review.`,
        type: NotificationType.IN_APP,
        priority: NotificationPriority.URGENT,
        metadata: {
          reportId: report.id,
          contentType: report.contentType,
          reason: report.reason,
          escalatedAt: report.escalatedAt?.toISOString(),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to send escalation notification to admin ${admin.id}`, err);
    }
  }
}
