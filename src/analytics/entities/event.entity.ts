import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum EventType {
  SIGNUP = 'signup',
  LOGIN = 'login',
  COURSE_VIEW = 'course_view',
  PURCHASE = 'purchase',
  COURSE_ENROLL = 'course_enroll',
  LESSON_COMPLETE = 'lesson_complete',
  QUIZ_ATTEMPT = 'quiz_attempt',
  COURSE_COMPLETE = 'course_complete',
  SEARCH = 'search',
  WISHLIST_ADD = 'wishlist_add',
  REVIEW_SUBMIT = 'review_submit',
  CUSTOM = 'custom',
}

/**
 * Represents user analytics events for tracking and analytics
 */
@Entity('analytics_events')
@Index(['userId', 'eventType', 'createdAt'])
@Index(['eventType', 'createdAt'])
@Index(['timestamp'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: EventType })
  eventType: EventType;

  @Column({ type: 'varchar', length: 64 })
  category: string;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  label?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  value?: number;

  @Column({ type: 'jsonb', nullable: true })
  properties?: Record<string, any>;

  @Column({ type: 'varchar', nullable: true })
  sessionId?: string;

  @Column({ type: 'varchar', nullable: true })
  fingerprintId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent?: string;

  @Column({ type: 'timestamp', precision: 3 })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
