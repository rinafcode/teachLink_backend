import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';

export enum OnboardingStepType {
  TUTORIAL = 'tutorial',
  PROFILE_SETUP = 'profile_setup',
  COURSE_EXPLORATION = 'course_exploration',
  FIRST_ENROLLMENT = 'first_enrollment',
  COMMUNITY_INTRO = 'community_intro',
}

export enum OnboardingStepStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('onboarding_steps')
@Index(['order'])
@Index(['type'])
export class OnboardingStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ unique: true })
  @Index()
  slug: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: OnboardingStepType,
  })
  @Index()
  type: OnboardingStepType;

  @Column({ type: 'int', default: 0 })
  @Index()
  order: number;

  @Column({ type: 'jsonb', nullable: true })
  content?: {
    videoUrl?: string;
    imageUrl?: string;
    steps?: string[];
    tips?: string[];
  };

  @Column({
    type: 'enum',
    enum: OnboardingStepStatus,
    default: OnboardingStepStatus.ACTIVE,
  })
  status: OnboardingStepStatus;

  @Column({ type: 'int', default: 0 })
  rewardPoints: number;

  @Column({ nullable: true })
  rewardBadgeId?: string;

  @Column({ default: false })
  isRequired: boolean;

  @Column({ type: 'int', default: 0 })
  estimatedDurationMinutes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
