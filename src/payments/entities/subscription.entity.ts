import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';
import { SubscriptionStatus, BillingInterval } from '../enums';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  courseId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column()
  currency: string;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @Column({ type: 'enum', enum: BillingInterval })
  billingInterval: BillingInterval;

  @Column({ nullable: true })
  providerSubscriptionId: string;

  @Column({ nullable: true })
  providerCustomerId: string;

  @Column('date')
  currentPeriodStart: Date;

  @Column('date')
  currentPeriodEnd: Date;

  @Column('date', { nullable: true })
  trialEnd: Date;

  @Column('date', { nullable: true })
  cancelledAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Course, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'courseId' })
  course: Course;
} 