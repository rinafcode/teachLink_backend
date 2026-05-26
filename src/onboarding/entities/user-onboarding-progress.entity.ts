import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OnboardingStep } from './onboarding-step.entity';

export enum OnboardingProgressStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

@Entity('user_onboarding_progress')
@Index(['userId', 'stepId'], { unique: true })
@Index(['userId', 'status'])
@Index(['completedAt'])
export class UserOnboardingProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'step_id' })
  @Index()
  stepId: string;

  @ManyToOne(() => OnboardingStep, { onDelete: 'CASCADE' })
  step: OnboardingStep;

  @Column({
    type: 'enum',
    enum: OnboardingProgressStatus,
    default: OnboardingProgressStatus.NOT_STARTED,
  })
  @Index()
  status: OnboardingProgressStatus;

  @Column({ type: 'float', default: 0 })
  progressPercentage: number; // 0 to 100

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  skippedAt?: Date;

  @Column({ type: 'int', default: 0 })
  timeSpentSeconds: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    lastViewedSection?: string;
    attempts?: number;
    quizScore?: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
