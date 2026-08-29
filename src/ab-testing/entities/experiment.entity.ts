import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  VersionColumn,
  Index,
} from 'typeorm';
import { IExperimentVariant } from './experiment-variant.entity';
import { ExperimentMetric } from './experiment-metric.entity';
export enum ExperimentStatus {
  DRAFT = 'draft',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}
export enum ExperimentType {
  A_B_TEST = 'a_b_test',
  MULTIVARIATE = 'multivariate',
  MULTI_ARMED_BANDIT = 'multi_armed_bandit',
}

/**
 * Represents the experiment entity.
 */
@Entity({ name: 'experiments' })
export class Experiment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Index('IDX_experiments_type')
  @Column({
    type: 'enum',
    enum: ExperimentType,
    default: ExperimentType.A_B_TEST,
  })
  type: ExperimentType;

  @Index('IDX_experiments_status')
  @Column({
    type: 'enum',
    enum: ExperimentStatus,
    default: ExperimentStatus.DRAFT,
  })
  status: ExperimentStatus;

  @Index('IDX_experiments_start_date')
  @Column({ type: 'timestamp' })
  startDate: Date;

  @Index('IDX_experiments_end_date')
  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 1.0 })
  trafficAllocation: number;

  @Column({ type: 'boolean', default: false })
  autoAllocateTraffic: boolean;

  @Column({ type: 'integer', default: 95 })
  confidenceLevel: number;

  @Column({ type: 'integer', default: 80 })
  minimumSampleSize: number;

  @Column({ type: 'text', nullable: true })
  hypothesis: string;

  @Column({ type: 'json', nullable: true })
  targetingCriteria: any;

  @Column({ type: 'json', nullable: true })
  exclusionCriteria: any;

  @Column({ type: 'json', nullable: true })
  properties?: Record<string, any>;

  @Index('IDX_experiments_created_at')
  @CreateDateColumn()
  createdAt: Date;

  @Index('IDX_experiments_updated_at')
  @UpdateDateColumn()
  updatedAt: Date;

  @LOneToMany(() => IExperimentVariant, (variant) => variant.experiment)
  variants: IExperimentVariant[];

  @LOneToMany(() => ExperimentMetric, (metric) => metric.experiment)
  metrics: ExperimentMetric[];
}