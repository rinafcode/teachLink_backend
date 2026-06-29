import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ContentReportReason } from './content-report-reason.enum';
import { ContentReportStatus } from './content-report-status.enum';

/**
 * Tracks each user report for content and how moderation resolves it.
 */
@Entity('content_reports')
export class ContentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  @Index()
  contentType: string;

  @Column()
  @Index()
  contentId: string;

  @Column({
    type: 'enum',
    enum: ContentReportReason,
  })
  reason: ContentReportReason;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  reporter?: User;

  @Column({ name: 'reporter_id', nullable: true })
  @Index()
  reporterId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  reviewer?: User;

  @Column({ name: 'reviewer_id', nullable: true })
  reviewerId?: string;

  /** The moderator currently assigned to handle this report (round-robin assigned). */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  assignedModerator?: User;

  @Column({ name: 'assigned_moderator_id', nullable: true })
  @Index()
  assignedModeratorId?: string;

  /** Set when the report is escalated to a senior moderator after SLA breach. */
  @Column({ type: 'timestamp', nullable: true })
  escalatedAt?: Date;

  @Column({
    type: 'enum',
    enum: ContentReportStatus,
    default: ContentReportStatus.PENDING,
  })
  @Index()
  status: ContentReportStatus;

  @Column({ name: 'moderation_item_id', nullable: true })
  @Index()
  moderationItemId?: number;

  @Column({ type: 'text', nullable: true })
  resolutionNote?: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
