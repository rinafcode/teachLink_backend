import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ActionType {
  WARN = 'warn',
  SUSPEND = 'suspend',
  BAN = 'ban',
  REMOVE_CONTENT = 'remove_content',
  HIDE_CONTENT = 'hide_content',
  FLAG_FOR_REVIEW = 'flag_for_review',
  APPROVE = 'approve',
  REJECT = 'reject',
  ESCALATE = 'escalate',
}

export enum ActionSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('moderation_actions')
@Index(['actionType', 'createdAt'])
export class ModerationAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contentId: string;

  @Column()
  contentType: string;

  @Index()
  @Column()
  moderatorId: string;

  @Index()
  @Column({
    type: 'enum',
    enum: ActionType,
  })
  actionType: ActionType;

  @Column({
    type: 'enum',
    enum: ActionSeverity,
    default: ActionSeverity.MEDIUM,
  })
  severity: ActionSeverity;

  @Column('text')
  reason: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: Record<string, any>;

  @Column({ nullable: true })
  duration: number; // in hours, for temporary actions

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ default: false })
  isAppealed: boolean;

  @Column({ nullable: true })
  appealId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 