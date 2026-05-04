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
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
export enum SubscriptionStatus {
    ACTIVE = 'active',
    CANCELLED = 'cancelled',
    PAST_DUE = 'past_due',
    UNPAID = 'unpaid',
    TRIALING = 'trialing',
    INCOMPLETE = 'incomplete'
}
export enum SubscriptionInterval {
    MONTHLY = 'monthly',
    YEARLY = 'yearly',
    QUARTERLY = 'quarterly',
    WEEKLY = 'weekly'
}

/**
 * Represents the subscription entity.
 */
@Entity('subscriptions')
@Index(['userId', 'status'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ type: 'varchar', unique: true, nullable: true })
  providerSubscriptionId: string;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  @Index()
  status: SubscriptionStatus;

  @Column({ type: 'enum', enum: SubscriptionInterval })
  interval: SubscriptionInterval;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd: Date;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEnd: Date;

  @ManyToOne(() => User, (user) => user.courses)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
