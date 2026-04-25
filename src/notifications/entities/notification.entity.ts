import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, Index, } from 'typeorm';
import { User } from '../../users/entities/user.entity';
export enum NotificationType {
    EMAIL = 'email',
    PUSH = 'push',
    IN_APP = 'in_app',
    SMS = 'sms'
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
    @Index()
    userId: string;
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;
    @Column()
    title: string;
    @Column('text')
    content: string;
    @Column({
        type: 'enum',
        enum: NotificationType,
        default: NotificationType.IN_APP,
    })
    type: NotificationType;
    @Column({
        type: 'enum',
        enum: NotificationPriority,
        default: NotificationPriority.MEDIUM,
    })
    priority: NotificationPriority;
    @Column({ default: false })
    isRead: boolean;
    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, unknown>;
    @Column({ nullable: true })
    readAt: Date;
    @CreateDateColumn()
    createdAt: Date;
    @UpdateDateColumn()
    @Index()
    updatedAt: Date;
    @DeleteDateColumn()
    deletedAt?: Date;
}
