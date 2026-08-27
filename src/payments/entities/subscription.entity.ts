import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
  INCOMPLETE = 'incomplete',
  PAUSED = 'paused',
}
export enum SubscriptionInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  QUARTERLY = 'quarterly',
  WEEKLY = 'weekly',
}

/**
 * Represents the subscription entity.
 */
@Entity('subscriptions')
@Index(['userId', 'status'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Subscription ID' })
  id: string;

  @VersionColumn()
  @ApiProperty({ description: 'Optimistic lock version' })
  version: number;

  @Column({ type: 'varchar', unique: true, nullable: true })
  @ApiPropertyOptional({ description: 'External provider subscription ID' })
  providerSubscriptionId: string;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  @Index()
  @ApiProperty({
    description: 'Subscription status',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({ type: 'enum', enum: SubscriptionInterval })
  @ApiProperty({
    description: 'Billing interval',
    enum: SubscriptionInterval,
    example: SubscriptionInterval.MONTHLY,
  })
  interval: SubscriptionInterval;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @ApiProperty({ description: 'Subscription amount', example: 29.99 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currency: string;

  @Column({ type: 'timestamp', nullable: true })
  @ApiPropertyOptional({ description: 'Current billing period start' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  @ApiPropertyOptional({ description: 'Current billing period end' })
  currentPeriodEnd: Date;

  @Column({ type: 'boolean', default: false })
  @ApiProperty({ description: 'Whether subscription cancels at period end' })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamp', nullable: true })
  @ApiPropertyOptional({ description: 'Cancellation date' })
  cancelledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  @ApiPropertyOptional({ description: 'Trial period start' })
  trialStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  @ApiPropertyOptional({ description: 'Trial period end' })
  trialEnd: Date;

  @Column({ type: 'jsonb', nullable: true })
  @ApiPropertyOptional({ description: 'Additional subscription properties' })
  properties?: Record<string, any>;

  @ManyToOne(() => User, (user) => user.courses)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  @Index()
  @ApiProperty({ description: 'User ID who owns the subscription' })
  userId: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'Subscription creation date' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @DeleteDateColumn()
  @ApiPropertyOptional({ description: 'Soft deletion date' })
  deletedAt?: Date;
}
