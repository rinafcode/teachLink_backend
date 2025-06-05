import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

export enum NotificationType {
  COURSE_UPDATE = 'course_update',
  MESSAGE = 'message',
  ASSIGNMENT = 'assignment',
  ANNOUNCEMENT = 'announcement',
  SYSTEM = 'system'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM
  })
  priority: NotificationPriority;

  @Column({ default: false })
  isRead: boolean;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  actionUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  readAt: Date;

  @Column({ default: true })
  isActive: boolean;
}
