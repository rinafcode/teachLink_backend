import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';

export enum RewardType {
  POINTS = 'points',
  BADGE = 'badge',
  COUPON = 'coupon',
  CERTIFICATE = 'certificate',
}

@Entity('onboarding_rewards')
@Index(['type'])
@Index(['isActive'])
export class OnboardingReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  @Index()
  name: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: RewardType,
  })
  @Index()
  type: RewardType;

  @Column({ type: 'int', default: 0 })
  pointsValue: number;

  @Column({ nullable: true })
  badgeId?: string;

  @Column({ nullable: true })
  couponCode?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    certificateTemplate?: string;
    discountPercentage?: number;
    expiryDate?: Date;
  };

  @Column({ type: 'int', default: 0 })
  requiredSteps: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
