import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum QueuePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum QueueStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_REVIEW = 'in_review',
  COMPLETED = 'completed',
  ESCALATED = 'escalated',
}

@Entity('moderation_queue')
@Index(['status', 'priority', 'createdAt'])
export class ModerationQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contentId: string;

  @Column()
  contentType: string;

  @Index()
  @Column({
    type: 'enum',
    enum: QueuePriority,
    default: QueuePriority.MEDIUM,
  })
  priority: QueuePriority;

  @Index()
  @Column({
    type: 'enum',
    enum: QueueStatus,
    default: QueueStatus.PENDING,
  })
  status: QueueStatus;

  @Index()
  @Column({ nullable: true })
  assignedModeratorId: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  safetyScore: number;

  @Column({ type: 'jsonb', nullable: true })
  autoModerationResult: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  flags: string[];

  @Column({ nullable: true })
  reportId: string;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 