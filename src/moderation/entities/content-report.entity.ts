import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';

export enum ReportType {
  INAPPROPRIATE = 'inappropriate',
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  COPYRIGHT = 'copyright',
  VIOLENCE = 'violence',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('content_reports')
@Index(['contentId', 'status', 'createdAt'])
export class ContentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reporterId: string;

  @Index()
  @Column()
  contentId: string;

  @Column()
  contentType: string; // 'course', 'lesson', 'comment', 'discussion'

  @Column({
    type: 'enum',
    enum: ReportType,
  })
  reportType: ReportType;

  @Column('text')
  description: string;

  @Index()
  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({ type: 'jsonb', nullable: true })
  evidence: Record<string, any>;

  @Column({ nullable: true })
  moderatorId: string;

  @Column({ nullable: true })
  resolution: string;

  @Column({ nullable: true })
  actionTaken: string;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 